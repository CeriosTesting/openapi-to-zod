import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, normalize } from "node:path";
import {
	analyzeSchemaUsage,
	ConfigurationError,
	createFilterStatistics,
	detectCircularReferences,
	expandTransitiveReferences,
	extractSchemaRefs,
	type FilterStatistics,
	formatFilterStatistics,
	getOperationName,
	LRUCache,
	loadOpenAPISpec,
	mergeParameters,
	resolveRefName,
	type SchemaContext,
	SchemaGenerationError,
	SpecValidationError,
	shouldIncludeOperation,
	stripPathPrefix,
	stripPrefix,
	toCamelCase,
	toPascalCase,
	validateFilters,
} from "@cerios/openapi-core";
import { minimatch } from "minimatch";
import { generateEnum } from "./generators/enum-generator";
import { generateJSDoc } from "./generators/jsdoc-generator";
import { PropertyGenerator } from "./generators/property-generator";
import type { OpenAPISchema, OpenAPISpec, OpenApiGeneratorOptions, ResolvedOptions } from "./types";
import { buildDateTimeValidation } from "./validators/string-validator";

export class OpenApiGenerator {
	private schemas: Map<string, string> = new Map();
	private types: Map<string, string> = new Map();
	private schemaDependencies: Map<string, Set<string>> = new Map();
	private options: OpenApiGeneratorOptions;
	private spec: OpenAPISpec;
	private propertyGenerator: PropertyGenerator;
	private schemaUsageMap: Map<string, SchemaContext> = new Map();
	private requestOptions: ResolvedOptions;
	private responseOptions: ResolvedOptions;
	private needsZodImport = true;
	private filterStats: FilterStatistics = createFilterStatistics();
	/** Instance-level pattern cache for parallel-safe execution */
	private patternCache: LRUCache<string, string>;
	/** Instance-level date-time validation string for parallel-safe execution */
	private dateTimeValidation: string;
	/** Track total allOf conflicts detected across all schemas */
	private allOfConflictCount = 0;
	/** Track schemas involved in circular dependency chains */
	private circularDependencies: Set<string> = new Set();

	constructor(options: OpenApiGeneratorOptions) {
		// Validate input path early
		if (!options.input) {
			throw new ConfigurationError("Input path is required", { providedOptions: options });
		}

		this.options = {
			mode: options.mode || "normal",
			input: options.input,
			outputTypes: options.outputTypes,
			includeDescriptions: options.includeDescriptions ?? true,
			useDescribe: options.useDescribe ?? false,
			defaultNullable: options.defaultNullable ?? false,
			emptyObjectBehavior: options.emptyObjectBehavior ?? "loose",
			schemaType: options.schemaType || "all",
			prefix: options.prefix,
			suffix: options.suffix,
			stripSchemaPrefix: options.stripSchemaPrefix,
			stripPathPrefix: options.stripPathPrefix,
			useOperationId: options.useOperationId ?? true,
			showStats: options.showStats ?? true,
			request: options.request,
			response: options.response,
			operationFilters: options.operationFilters,
			ignoreHeaders: options.ignoreHeaders,
			cacheSize: options.cacheSize ?? 1000,
			batchSize: options.batchSize ?? 10,
			customDateTimeFormatRegex: options.customDateTimeFormatRegex,
		};

		// Create instance-level pattern cache (parallel-safe)
		this.patternCache = new LRUCache<string, string>(this.options.cacheSize ?? 1000);

		// Build date-time validation string (parallel-safe, no global state)
		this.dateTimeValidation = buildDateTimeValidation(this.options.customDateTimeFormatRegex);

		// Load and parse the OpenAPI specification using core utility
		this.spec = loadOpenAPISpec(this.options.input);

		this.validateSpec();

		// Resolve options for request and response contexts
		this.requestOptions = this.resolveOptionsForContext("request");
		this.responseOptions = this.resolveOptionsForContext("response");

		// Analyze schema usage to determine context (request/response/both)
		this.initializeSchemaUsage();

		// Initialize property generator with context
		// We'll update this dynamically based on schema context during generation
		this.propertyGenerator = new PropertyGenerator({
			spec: this.spec,
			schemaDependencies: this.schemaDependencies,
			schemaType: this.options.schemaType || "all",
			mode: this.requestOptions.mode,
			includeDescriptions: this.requestOptions.includeDescriptions,
			useDescribe: this.requestOptions.useDescribe,
			defaultNullable: this.options.defaultNullable ?? false,
			emptyObjectBehavior: this.options.emptyObjectBehavior ?? "loose",
			namingOptions: {
				prefix: this.options.prefix,
				suffix: this.options.suffix,
			},
			stripSchemaPrefix: this.options.stripSchemaPrefix,
			dateTimeValidation: this.dateTimeValidation,
			patternCache: this.patternCache,
		});
	}

	/**
	 * Generate schemas as a string (without writing to file)
	 * @returns The generated TypeScript code as a string
	 */
	generateString(): string {
		if (!this.spec.components?.schemas) {
			throw new SpecValidationError("No schemas found in OpenAPI spec", { filePath: this.options.input });
		}

		// Pre-analyze schemas to detect circular dependencies BEFORE generation
		// This allows us to use z.lazy() for references to circular deps
		this.analyzeCircularDependencies();

		// Update property generator context with circular dependencies
		this.propertyGenerator.setCircularDependencies(this.circularDependencies);

		// Generate schemas and track dependencies
		for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
			// Skip schemas not referenced by filtered operations when operation filters are active
			if (this.options.operationFilters && this.schemaUsageMap.size > 0 && !this.schemaUsageMap.has(name)) {
				continue;
			}
			this.generateComponentSchema(name, schema);
		}

		// Generate query parameter schemas from path operations
		this.generateQueryParameterSchemas();

		// Generate header parameter schemas from path operations
		this.generateHeaderParameterSchemas();

		// Validate filters and emit warnings if needed
		validateFilters(this.filterStats, this.options.operationFilters);

		// Sort schemas by dependencies
		const orderedSchemaNames = this.topologicalSort();

		// Build output
		const output: string[] = ["// Auto-generated by @cerios/openapi-to-zod", "// Do not edit this file manually", ""];

		// Add statistics if enabled (must be explicitly true)
		if (this.options.showStats === true) {
			output.push(...this.generateStats());
			output.push("");
		}

		// Conditionally import Zod only if needed
		if (this.needsZodImport) {
			output.push('import { z } from "zod";');
			output.push("");
		}

		// Add schemas and types in dependency order
		output.push("// Schemas and Types");
		for (const name of orderedSchemaNames) {
			const schemaCode = this.schemas.get(name);
			const typeCode = this.types.get(name);

			if (schemaCode) {
				// Zod schema with inferred type
				output.push(schemaCode);

				// Add type immediately after schema (if not already included)
				// Convert schema name to valid TypeScript type name (handles dotted names)
				// Apply stripSchemaPrefix before type name generation
				const strippedName = stripPrefix(name, this.options.stripSchemaPrefix);
				const typeName = toPascalCase(strippedName);
				if (!schemaCode.includes(`export type ${typeName}`)) {
					const schemaName = `${toCamelCase(strippedName, { prefix: this.options.prefix, suffix: this.options.suffix })}Schema`;
					output.push(`export type ${typeName} = z.infer<typeof ${schemaName}>;`);
				}
				output.push("");
			} else if (typeCode) {
				// Type only (shouldn't happen in Zod-only mode, but kept for safety)
				output.push(typeCode);
				output.push("");
			}
		}
		return output.join("\n");
	}

	/**
	 * Ensure directory exists for a file path
	 */
	private ensureDirectoryExists(filePath: string): void {
		const normalizedPath = normalize(filePath);
		const dir = dirname(normalizedPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}

	/**
	 * Generate the complete output file
	 */
	generate(): void {
		const output = this.generateString();
		const normalizedOutput = normalize(this.options.outputTypes);
		this.ensureDirectoryExists(normalizedOutput);
		writeFileSync(normalizedOutput, output);
		console.log(`  ✓ Generated ${normalizedOutput}`);
	}

	/**
	 * Resolve options for a specific context (request or response)
	 * Nested options silently override root-level options
	 */
	private resolveOptionsForContext(context: "request" | "response"): ResolvedOptions {
		const contextOptions = context === "request" ? this.options.request : this.options.response;

		return {
			mode: contextOptions?.mode ?? this.options.mode ?? "normal",
			useDescribe: contextOptions?.useDescribe ?? this.options.useDescribe ?? false,
			includeDescriptions: contextOptions?.includeDescriptions ?? this.options.includeDescriptions ?? true,
		};
	}

	/**
	 * Initialize schema usage map using core utilities with operation filtering
	 * This is a wrapper around core's analyzeSchemaUsage that adds operation filtering
	 */
	private initializeSchemaUsage(): void {
		// If we have operation filters, we need to track stats and filter manually
		if (this.options.operationFilters && this.spec.paths) {
			const requestSchemas = new Set<string>();
			const responseSchemas = new Set<string>();

			for (const [path, pathItem] of Object.entries(this.spec.paths)) {
				const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
				for (const method of methods) {
					const operation = (pathItem as Record<string, unknown>)[method];
					if (typeof operation !== "object" || !operation) continue;

					// Track total operations
					this.filterStats.totalOperations++;

					// Apply operation filters
					if (!shouldIncludeOperation(operation, path, method, this.options.operationFilters, this.filterStats)) {
						continue;
					}

					// Count included operation
					this.filterStats.includedOperations++;

					const op = operation as Record<string, unknown>;

					// Check request bodies
					if (op.requestBody && typeof op.requestBody === "object") {
						const reqBody = op.requestBody as Record<string, unknown>;
						if (reqBody.content && typeof reqBody.content === "object") {
							for (const mediaType of Object.values(reqBody.content)) {
								if (mediaType && typeof mediaType === "object") {
									const mt = mediaType as Record<string, unknown>;
									if (mt.schema) {
										extractSchemaRefs(mt.schema as OpenAPISchema, requestSchemas);
									}
								}
							}
						}
					}

					// Check responses
					if (op.responses && typeof op.responses === "object") {
						for (const response of Object.values(op.responses)) {
							if (response && typeof response === "object") {
								const resp = response as Record<string, unknown>;
								if (resp.content && typeof resp.content === "object") {
									for (const mediaType of Object.values(resp.content)) {
										if (mediaType && typeof mediaType === "object") {
											const mt = mediaType as Record<string, unknown>;
											if (mt.schema) {
												extractSchemaRefs(mt.schema as OpenAPISchema, responseSchemas);
											}
										}
									}
								}
							}
						}
					}

					// Check parameters
					if (op.parameters && Array.isArray(op.parameters)) {
						for (const param of op.parameters) {
							if (param && typeof param === "object") {
								const p = param as Record<string, unknown>;
								if (p.schema) {
									extractSchemaRefs(p.schema as OpenAPISchema, requestSchemas);
								}
							}
						}
					}
				}
			}

			// Expand transitive references to include all indirectly referenced schemas
			expandTransitiveReferences(requestSchemas, this.spec);
			expandTransitiveReferences(responseSchemas, this.spec);

			// Build usage map from filtered operations
			for (const [name] of Object.entries(this.spec.components?.schemas || {})) {
				if (requestSchemas.has(name) && responseSchemas.has(name)) {
					this.schemaUsageMap.set(name, "both");
				} else if (requestSchemas.has(name)) {
					this.schemaUsageMap.set(name, "request");
				} else if (responseSchemas.has(name)) {
					this.schemaUsageMap.set(name, "response");
				}
			}

			// Detect circular references and mark as "both"
			const circularSchemas = detectCircularReferences(this.spec);
			for (const name of circularSchemas) {
				this.schemaUsageMap.set(name, "both");
			}
		} else {
			// Use core's analyzeSchemaUsage when no operation filters
			const analysis = analyzeSchemaUsage(this.spec);
			this.schemaUsageMap = analysis.usageMap;

			// Track operation stats when no filters
			if (this.spec.paths) {
				for (const pathItem of Object.values(this.spec.paths)) {
					const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
					for (const method of methods) {
						const operation = (pathItem as Record<string, unknown>)[method];
						if (typeof operation === "object" && operation) {
							this.filterStats.totalOperations++;
							this.filterStats.includedOperations++;
						}
					}
				}
			}
		}
	}

	/**
	 * Validate the OpenAPI specification
	 */
	private validateSpec(): void {
		if (!this.spec.components?.schemas) {
			throw new SpecValidationError(
				`No schemas found in OpenAPI spec at ${this.options.input}. Expected to find schemas at components.schemas`,
				{ filePath: this.options.input }
			);
		}

		// Validate all $refs can be resolved
		const allSchemas = Object.keys(this.spec.components.schemas);
		for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
			try {
				this.validateSchemaRefs(name, schema, allSchemas);
			} catch (error) {
				if (error instanceof Error) {
					throw new SchemaGenerationError(`Invalid schema '${name}': ${error.message}`, name, {
						originalError: error.message,
					});
				}
				throw error;
			}
		}
	}

	/**
	 * Validate all $ref references in a schema
	 */
	private validateSchemaRefs(schemaName: string, schema: OpenAPISchema, allSchemas: string[], path = ""): void {
		if (schema.$ref) {
			const refName = resolveRefName(schema.$ref);
			if (!allSchemas.includes(refName)) {
				throw new SpecValidationError(
					`Invalid reference${path ? ` at '${path}'` : ""}: ` +
						`'${schema.$ref}' points to non-existent schema '${refName}'`,
					{ schemaName, path, ref: schema.$ref, refName }
				);
			}
		}

		// Recursively validate nested schemas
		if (schema.properties) {
			for (const [propName, propSchema] of Object.entries(schema.properties)) {
				this.validateSchemaRefs(schemaName, propSchema, allSchemas, path ? `${path}.${propName}` : propName);
			}
		}

		if (schema.items) {
			this.validateSchemaRefs(schemaName, schema.items, allSchemas, `${path}[]`);
		}

		if (schema.prefixItems) {
			schema.prefixItems.forEach((s, i) => {
				this.validateSchemaRefs(schemaName, s, allSchemas, `${path}.prefixItems[${i}]`);
			});
		}

		if (schema.allOf) {
			schema.allOf.forEach((s, i) => {
				this.validateSchemaRefs(schemaName, s, allSchemas, `${path}.allOf[${i}]`);
			});
		}

		if (schema.oneOf) {
			schema.oneOf.forEach((s, i) => {
				this.validateSchemaRefs(schemaName, s, allSchemas, `${path}.oneOf[${i}]`);
			});
		}

		if (schema.anyOf) {
			schema.anyOf.forEach((s, i) => {
				this.validateSchemaRefs(schemaName, s, allSchemas, `${path}.anyOf[${i}]`);
			});
		}
	}

	/**
	 * Generate schema for a component
	 */
	private generateComponentSchema(name: string, schema: OpenAPISchema): void {
		// Initialize dependencies for this schema
		if (!this.schemaDependencies.has(name)) {
			this.schemaDependencies.set(name, new Set());
		}

		const context = this.schemaUsageMap.get(name);
		const resolvedOptions = context === "response" ? this.responseOptions : this.requestOptions;

		// Handle enums at the top level
		if (schema.enum) {
			const jsdoc = generateJSDoc(schema, name, { includeDescriptions: resolvedOptions.includeDescriptions });

			// Apply stripSchemaPrefix before generating enum
			const strippedName = stripPrefix(name, this.options.stripSchemaPrefix);

			// Generate Zod enum
			const { schemaCode, typeCode } = generateEnum(strippedName, schema.enum, {
				prefix: this.options.prefix,
				suffix: this.options.suffix,
			});

			const enumSchemaCode = `${jsdoc}${schemaCode}\n${typeCode}`;
			this.schemas.set(name, enumSchemaCode);
			return;
		}

		// Generate Zod schema
		// Apply stripSchemaPrefix to get cleaner schema names
		const strippedName = stripPrefix(name, this.options.stripSchemaPrefix);
		const schemaName = `${toCamelCase(strippedName, { prefix: this.options.prefix, suffix: this.options.suffix })}Schema`;
		let jsdoc = generateJSDoc(schema, name, { includeDescriptions: resolvedOptions.includeDescriptions });

		// For allOf with single $ref, track dependency manually since we simplify it
		if (schema.allOf && schema.allOf.length === 1 && schema.allOf[0].$ref) {
			const refName = resolveRefName(schema.allOf[0].$ref);
			this.schemaDependencies.get(name)?.add(refName);
		}

		// Update property generator context for this schema
		this.propertyGenerator = new PropertyGenerator({
			spec: this.spec,
			schemaDependencies: this.schemaDependencies,
			schemaType: this.options.schemaType || "all",
			mode: resolvedOptions.mode,
			includeDescriptions: resolvedOptions.includeDescriptions,
			useDescribe: resolvedOptions.useDescribe,
			defaultNullable: this.options.defaultNullable ?? false,
			emptyObjectBehavior: this.options.emptyObjectBehavior ?? "loose",
			namingOptions: {
				prefix: this.options.prefix,
				suffix: this.options.suffix,
			},
			stripSchemaPrefix: this.options.stripSchemaPrefix,
			dateTimeValidation: this.dateTimeValidation,
			patternCache: this.patternCache,
		});

		// Set circular dependencies for the new property generator instance
		this.propertyGenerator.setCircularDependencies(this.circularDependencies);

		// Clear conflicts before generating to track per-schema conflicts
		this.propertyGenerator.clearAllOfConflicts();

		// Check if this is just a simple $ref (alias)
		// Pass isTopLevel=true for top-level schema generation to prevent defaultNullable from applying
		const zodSchema = this.propertyGenerator.generatePropertySchema(schema, name, true);

		// Check for allOf conflicts and add JSDoc warning if any
		const allOfConflicts = this.propertyGenerator.getAllOfConflicts();
		if (allOfConflicts.length > 0) {
			this.allOfConflictCount += allOfConflicts.length;
			// Add warning JSDoc for conflicts
			const conflictWarning = this.generateConflictJSDoc(allOfConflicts);
			if (jsdoc) {
				// Append to existing JSDoc - insert before closing */
				jsdoc = jsdoc.replace(/ \*\/\n$/, `\n${conflictWarning} */\n`);
			} else {
				// Create new JSDoc block with just the warning
				jsdoc = `/**\n${conflictWarning} */\n`;
			}
		}

		const zodSchemaCode = `${jsdoc}export const ${schemaName} = ${zodSchema};`;

		// Track dependencies from discriminated unions
		// Extract schema references like "carSchema, truckSchema" from discriminatedUnion calls
		if (zodSchema.includes("z.discriminatedUnion(")) {
			const match = zodSchema.match(/z\.discriminatedUnion\([^,]+,\s*\[([^\]]+)\]/);
			if (match) {
				const refs = match[1].split(",").map(ref => ref.trim());
				for (const ref of refs) {
					// Extract schema name from camelCase reference (e.g., "carSchema" -> "Car")
					const depMatch = ref.match(/^([a-z][a-zA-Z0-9]*?)Schema$/);
					if (depMatch) {
						// Convert camelCase to PascalCase (carSchema -> Car)
						const depName = depMatch[1].charAt(0).toUpperCase() + depMatch[1].slice(1);
						this.schemaDependencies.get(name)?.add(depName);
					}
				}
			}
		}

		this.schemas.set(name, zodSchemaCode);
	}

	/**
	 * Generate query parameter schemas for each operation
	 */
	private generateQueryParameterSchemas(): void {
		if (!this.spec.paths) {
			return;
		}

		for (const [path, pathItem] of Object.entries(this.spec.paths)) {
			if (!pathItem || typeof pathItem !== "object") continue;

			const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

			for (const method of methods) {
				const operation = (pathItem as any)[method];
				if (!operation) continue;

				// Apply operation filters (stats already tracked in analyzeSchemaUsage)
				if (!shouldIncludeOperation(operation, path, method, this.options.operationFilters)) {
					continue;
				}

				// Merge path-level and operation-level parameters, resolving $refs
				const allParams = mergeParameters(pathItem.parameters, operation.parameters, this.spec);

				// Filter for query parameters only
				const queryParams = allParams.filter(
					(param: any) => param && typeof param === "object" && param.in === "query"
				);

				if (queryParams.length === 0) {
					continue;
				}

				const strippedPath = stripPathPrefix(path, this.options.stripPathPrefix);
				const pascalOperationId = getOperationName(
					operation.operationId,
					method,
					strippedPath,
					this.options.useOperationId
				);
				const schemaName = `${pascalOperationId}QueryParams`; // Initialize dependencies for this schema
				if (!this.schemaDependencies.has(schemaName)) {
					this.schemaDependencies.set(schemaName, new Set());
				}

				// Build object schema properties
				const properties: Record<string, string> = {};
				const required: string[] = [];

				for (const param of queryParams) {
					const paramName = param.name;
					const isRequired = param.required === true;
					const paramSchema = param.schema;

					if (!paramSchema) continue;

					// Generate Zod schema for this parameter
					let zodType = this.generateQueryParamType(paramSchema, param);

					// Handle arrays with serialization styles
					if (paramSchema.type === "array" && paramSchema.items) {
						const itemType = this.generateQueryParamType(paramSchema.items, param);

						// Note: Query param arrays are sent as strings and need to be split on the client side
						// The style is documented but validation is for the array type
						zodType = `z.array(${itemType})`;

						// Description is handled by addDescription below
					} // Add description if available (before .optional())
					if (param.description && this.requestOptions.includeDescriptions) {
						if (this.requestOptions.useDescribe) {
							zodType = `${zodType}.describe(${JSON.stringify(param.description)})`;
						}
					}

					// Make optional if not required (don't add defaults)
					if (!isRequired) {
						zodType = `${zodType}.optional()`;
					}

					properties[paramName] = zodType;
					if (isRequired) {
						required.push(paramName);
					}

					// Track dependencies from schema references
					if (paramSchema.$ref) {
						const refName = resolveRefName(paramSchema.$ref);
						this.schemaDependencies.get(schemaName)?.add(refName);
					}
				}

				// Generate the object schema code
				const objectMode = this.requestOptions.mode;
				const zodMethod = objectMode === "strict" ? "strictObject" : objectMode === "loose" ? "looseObject" : "object";

				const propsCode = Object.entries(properties)
					.map(([key, value]) => {
						// Quote property names that contain special characters or are not valid identifiers
						const needsQuotes = !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
						const quotedKey = needsQuotes ? `"${key}"` : key;
						return `  ${quotedKey}: ${value}`;
					})
					.join(",\n");

				const schemaCode = `z.${zodMethod}({\n${propsCode}\n})`;
				// Apply prefix/suffix using toCamelCase for consistent naming with how generateString generates the type inference
				const operationName = pascalOperationId;
				const camelCaseSchemaName = `${toCamelCase(operationName, { prefix: this.options.prefix, suffix: this.options.suffix })}QueryParamsSchema`;

				// Generate JSDoc - use operationId if available, otherwise use method + path
				const jsdocOperationName = operation.operationId || `${method.toUpperCase()} ${path}`;
				const jsdoc = `/**\n * Query parameters for ${jsdocOperationName}\n */\n`;
				const fullSchemaCode = `${jsdoc}export const ${camelCaseSchemaName} = ${schemaCode};`;

				this.schemas.set(schemaName, fullSchemaCode);
				this.needsZodImport = true;
			}
		}
	}

	/**
	 * Check if a header should be ignored based on filter patterns
	 * @internal
	 */
	private shouldIgnoreHeader(headerName: string): boolean {
		const ignorePatterns = this.options.ignoreHeaders;
		if (!ignorePatterns || ignorePatterns.length === 0) {
			return false;
		}

		if (ignorePatterns.includes("*")) {
			return true;
		}

		const headerLower = headerName.toLowerCase();

		return ignorePatterns.some((pattern: string) => {
			const patternLower = pattern.toLowerCase();
			return minimatch(headerLower, patternLower);
		});
	}

	/**
	 * Generate header parameter schemas for each operation
	 * Header parameters are always string type (HTTP header semantics)
	 */
	private generateHeaderParameterSchemas(): void {
		if (!this.spec.paths) {
			return;
		}

		for (const [path, pathItem] of Object.entries(this.spec.paths)) {
			if (!pathItem || typeof pathItem !== "object") continue;

			const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

			for (const method of methods) {
				const operation = (pathItem as any)[method];
				if (!operation) continue;

				// Apply operation filters
				if (!shouldIncludeOperation(operation, path, method, this.options.operationFilters)) {
					continue;
				}

				// Merge path-level and operation-level parameters, resolving $refs
				const allParams = mergeParameters(pathItem.parameters, operation.parameters, this.spec);

				// Filter for header parameters only, excluding ignored ones
				const headerParams = allParams.filter(
					(param: any) =>
						param && typeof param === "object" && param.in === "header" && !this.shouldIgnoreHeader(param.name)
				);

				if (headerParams.length === 0) {
					continue;
				}

				const strippedPath = stripPathPrefix(path, this.options.stripPathPrefix);
				const pascalOperationId = getOperationName(
					operation.operationId,
					method,
					strippedPath,
					this.options.useOperationId
				);
				const schemaName = `${pascalOperationId}HeaderParams`;

				// Initialize dependencies for this schema
				if (!this.schemaDependencies.has(schemaName)) {
					this.schemaDependencies.set(schemaName, new Set());
				}

				// Build object schema properties (headers are always strings)
				const properties: Record<string, string> = {};

				for (const param of headerParams) {
					const paramName = param.name;
					const paramSchema = param.schema;

					if (!paramSchema) continue;

					// Headers are always strings in HTTP, regardless of schema type
					let zodType = "z.string()";

					// Add description if available
					if (param.description && this.requestOptions.includeDescriptions) {
						if (this.requestOptions.useDescribe) {
							zodType = `${zodType}.describe(${JSON.stringify(param.description)})`;
						}
					}

					// Headers are always optional in service layer (as per requirements)
					zodType = `${zodType}.optional()`;

					properties[paramName] = zodType;

					// Track dependencies from schema references (if any)
					if (paramSchema.$ref) {
						const refName = resolveRefName(paramSchema.$ref);
						this.schemaDependencies.get(schemaName)?.add(refName);
					}
				}

				// Generate the object schema code
				const objectMode = this.requestOptions.mode;
				const zodMethod = objectMode === "strict" ? "strictObject" : objectMode === "loose" ? "looseObject" : "object";

				const propsCode = Object.entries(properties)
					.map(([key, value]) => {
						// Quote property names that contain special characters or are not valid identifiers
						const needsQuotes = !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
						const quotedKey = needsQuotes ? `"${key}"` : key;
						return `  ${quotedKey}: ${value}`;
					})
					.join(",\n");

				const schemaCode = `z.${zodMethod}({\n${propsCode}\n})`;

				// Apply prefix/suffix to the operation name only, then add HeaderParams and Schema
				// Use toCamelCase for consistent naming with how generateString generates the type inference
				const operationName = pascalOperationId;
				const camelCaseSchemaName = `${toCamelCase(operationName, { prefix: this.options.prefix, suffix: this.options.suffix })}HeaderParamsSchema`;

				// Generate JSDoc - use operationId if available, otherwise use method + path
				const jsdocOperationName = operation.operationId || `${method.toUpperCase()} ${path}`;
				const jsdoc = `/**\n * Header parameters for ${jsdocOperationName}\n */\n`;
				const fullSchemaCode = `${jsdoc}export const ${camelCaseSchemaName} = ${schemaCode};`;

				this.schemas.set(schemaName, fullSchemaCode);
				this.needsZodImport = true;
			}
		}
	}

	/**
	 * Generate Zod type for a query parameter schema
	 */
	private generateQueryParamType(schema: OpenAPISchema, param: any): string {
		// Handle references
		if (schema.$ref) {
			const refName = resolveRefName(schema.$ref);
			// Apply stripSchemaPrefix to referenced schema names
			const strippedRefName = stripPrefix(refName, this.options.stripSchemaPrefix);
			const schemaName = toCamelCase(strippedRefName, { prefix: this.options.prefix, suffix: this.options.suffix });
			return `${schemaName}Schema`;
		}

		// Handle enums
		if (schema.enum) {
			// Check if all values are booleans
			const allBooleans = schema.enum.every((v: any) => typeof v === "boolean");
			if (allBooleans) {
				return "z.boolean()";
			}

			// Check if all values are strings
			const allStrings = schema.enum.every((v: any) => typeof v === "string");
			if (allStrings) {
				const enumValues = schema.enum.map(v => `"${v}"`).join(", ");
				return `z.enum([${enumValues}])`;
			}

			// For numeric or mixed enums, use z.union with z.literal
			const literalValues = schema.enum
				.map((v: any) => {
					if (typeof v === "string") {
						return `z.literal("${v}")`;
					}
					return `z.literal(${v})`;
				})
				.join(", ");
			return `z.union([${literalValues}])`;
		}

		// Handle primitive types
		const type = schema.type;

		if (type === "string") {
			// Use Zod v4 top-level format validators for known formats
			const formatMap: Record<string, string> = {
				email: "z.email()",
				uri: "z.url()",
				url: "z.url()",
				uuid: "z.uuid()",
			};

			// Check if format has a dedicated Zod v4 validator
			if (schema.format && formatMap[schema.format]) {
				let zodType = formatMap[schema.format];
				// Add string validations (these still work on format types)
				if (schema.minLength !== undefined) zodType = `${zodType}.min(${schema.minLength})`;
				if (schema.maxLength !== undefined) zodType = `${zodType}.max(${schema.maxLength})`;
				if (schema.pattern) zodType = `${zodType}.regex(/${schema.pattern}/)`;
				return zodType;
			}

			// Fallback to z.string() for unknown formats or no format
			let zodType = "z.string()";
			if (schema.minLength !== undefined) zodType = `${zodType}.min(${schema.minLength})`;
			if (schema.maxLength !== undefined) zodType = `${zodType}.max(${schema.maxLength})`;
			if (schema.pattern) zodType = `${zodType}.regex(/${schema.pattern}/)`;
			return zodType;
		}

		if (type === "number" || type === "integer") {
			let zodType = type === "integer" ? "z.number().int()" : "z.number()";
			// Add number validations
			if (schema.minimum !== undefined) {
				zodType = schema.exclusiveMinimum ? `${zodType}.gt(${schema.minimum})` : `${zodType}.gte(${schema.minimum})`;
			}
			if (schema.maximum !== undefined) {
				zodType = schema.exclusiveMaximum ? `${zodType}.lt(${schema.maximum})` : `${zodType}.lte(${schema.maximum})`;
			}
			return zodType;
		}

		if (type === "boolean") {
			return "z.boolean()";
		}

		if (type === "array" && schema.items) {
			const itemType = this.generateQueryParamType(schema.items, param);
			let arrayType = `z.array(${itemType})`;
			// Add array validations
			if (schema.minItems !== undefined) arrayType = `${arrayType}.min(${schema.minItems})`;
			if (schema.maxItems !== undefined) arrayType = `${arrayType}.max(${schema.maxItems})`;
			return arrayType;
		}

		// Fallback to z.unknown() for unhandled types
		return "z.unknown()";
	}

	/**
	 * Topological sort for schema dependencies
	 * Returns schemas in the order they should be declared
	 */
	private topologicalSort(): string[] {
		const sorted: string[] = [];
		const visited = new Set<string>();
		const visiting = new Set<string>();
		const aliases: string[] = [];
		const circularDeps = new Set<string>(); // Track schemas involved in circular dependencies

		// Performance optimization: Cache schema and type code lookups
		const codeCache = new Map<string, string>();
		for (const [name, code] of this.schemas) {
			codeCache.set(name, code);
		}
		for (const [name, code] of this.types) {
			codeCache.set(name, code);
		}

		const visit = (name: string): void => {
			if (visited.has(name)) return;

			// Detect circular dependencies
			if (visiting.has(name)) {
				// Mark this as a circular dependency but don't add it yet
				circularDeps.add(name);
				return;
			}

			visiting.add(name);

			// Check if this is a simple alias (just assigns another schema directly)
			const code = codeCache.get(name) || "";
			const isSimpleAlias =
				code.match(/= (\w+Schema);$/) !== null &&
				!code.includes("z.object") &&
				!code.includes("z.enum") &&
				!code.includes("z.union") &&
				!code.includes("z.array") &&
				!code.includes(".and(");

			if (isSimpleAlias) {
				// For simple aliases, just mark as visited and add to aliases list
				visiting.delete(name);
				visited.add(name);
				aliases.push(name);
				return;
			}

			// Visit dependencies first for non-alias schemas
			const deps = this.schemaDependencies.get(name);
			let dependsOnCircular = false;
			if (deps && deps.size > 0) {
				for (const dep of deps) {
					if (this.schemas.has(dep) || this.types.has(dep)) {
						visit(dep);
						// If this dependency is circular, we also need to be deferred
						if (circularDeps.has(dep)) {
							dependsOnCircular = true;
						}
					}
				}
			}

			visiting.delete(name);
			visited.add(name);

			// Don't add circular dependencies or schemas that depend on them yet
			// They need special handling and will be added at the end
			if (!circularDeps.has(name) && !dependsOnCircular) {
				sorted.push(name);
			} else if (dependsOnCircular && !circularDeps.has(name)) {
				// Mark schemas that depend on circular deps as needing to be deferred
				circularDeps.add(name);
			}
		};

		// Visit all schemas and types
		const allNames = new Set([...this.schemas.keys(), ...this.types.keys()]);
		for (const name of allNames) {
			visit(name);
		}

		// Add circular dependencies at the end (before aliases)
		// This ensures they come after their non-circular dependencies
		// Note: circular deps ARE in visited (they complete their visit cycle),
		// but they were excluded from sorted. We need to add them now.
		for (const name of circularDeps) {
			if (!sorted.includes(name)) {
				sorted.push(name);
			}
		}

		// Add aliases at the end
		return [...sorted, ...aliases];
	}

	/**
	 * Generate statistics about the generated schemas
	 */
	private generateStats(): string[] {
		const stats = {
			totalSchemas: this.schemas.size,
			withCircularRefs: 0,
			withDiscriminators: 0,
			withConstraints: 0,
		};

		// Count schemas with special features
		for (const code of this.schemas.values()) {
			if (code.includes("z.lazy(")) stats.withCircularRefs++;
			if (code.includes("z.discriminatedUnion")) stats.withDiscriminators++;
			if (code.includes(".min(") || code.includes(".max(") || code.includes(".gte(")) {
				stats.withConstraints++;
			}
		}

		const output = [
			"// Generation Statistics:",
			`//   Total schemas: ${stats.totalSchemas}`,
			`//   Circular references: ${stats.withCircularRefs}`,
			`//   Discriminated unions: ${stats.withDiscriminators}`,
			`//   With constraints: ${stats.withConstraints}`,
			`//   AllOf conflicts: ${this.allOfConflictCount}`,
		];

		// Add filter statistics if filtering was used
		if (this.options.operationFilters && this.filterStats.totalOperations > 0) {
			output.push("//");
			const filterStatsStr = formatFilterStatistics(this.filterStats);
			for (const line of filterStatsStr.split("\n")) {
				output.push(`//   ${line}`);
			}
		}

		output.push(`//   Generated at: ${new Date().toISOString()}`);

		return output;
	}

	/**
	 * Pre-analyze schemas to detect circular dependencies before code generation.
	 * This allows the property generator to use z.lazy() for forward references.
	 */
	private analyzeCircularDependencies(): void {
		if (!this.spec.components?.schemas) return;

		// First pass: collect all schema dependencies without generating code
		const dependencies = new Map<string, Set<string>>();

		const collectDependencies = (name: string, schema: OpenAPISchema, visited = new Set<string>()): Set<string> => {
			if (visited.has(name)) return new Set();
			visited.add(name);

			const deps = new Set<string>();

			// Handle $ref
			if (schema.$ref) {
				const refName = resolveRefName(schema.$ref);
				deps.add(refName);
			}

			// Handle allOf
			if (schema.allOf) {
				for (const item of schema.allOf) {
					const itemDeps = collectDependencies(`${name}_allOf`, item, new Set(visited));
					for (const dep of itemDeps) deps.add(dep);
				}
			}

			// Handle oneOf
			if (schema.oneOf) {
				for (const item of schema.oneOf) {
					const itemDeps = collectDependencies(`${name}_oneOf`, item, new Set(visited));
					for (const dep of itemDeps) deps.add(dep);
				}
			}

			// Handle anyOf
			if (schema.anyOf) {
				for (const item of schema.anyOf) {
					const itemDeps = collectDependencies(`${name}_anyOf`, item, new Set(visited));
					for (const dep of itemDeps) deps.add(dep);
				}
			}

			// Handle properties
			if (schema.properties) {
				for (const propSchema of Object.values(schema.properties)) {
					const propDeps = collectDependencies(`${name}_prop`, propSchema, new Set(visited));
					for (const dep of propDeps) deps.add(dep);
				}
			}

			// Handle array items
			if (schema.items) {
				const itemDeps = collectDependencies(`${name}_items`, schema.items, new Set(visited));
				for (const dep of itemDeps) deps.add(dep);
			}

			// Handle additionalProperties
			if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
				const addDeps = collectDependencies(`${name}_additional`, schema.additionalProperties, new Set(visited));
				for (const dep of addDeps) deps.add(dep);
			}

			return deps;
		};

		// Collect dependencies for all schemas
		for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
			// Skip schemas not referenced by filtered operations when operation filters are active
			if (this.options.operationFilters && this.schemaUsageMap.size > 0 && !this.schemaUsageMap.has(name)) {
				continue;
			}
			dependencies.set(name, collectDependencies(name, schema));
		}

		// Second pass: detect circular dependencies using DFS
		const visited = new Set<string>();
		const visiting = new Set<string>();

		const detectCircular = (name: string, path: string[] = []): void => {
			if (visited.has(name)) return;

			if (visiting.has(name)) {
				// Found a cycle - mark all schemas in the cycle as circular
				const cycleStart = path.indexOf(name);
				if (cycleStart >= 0) {
					for (let i = cycleStart; i < path.length; i++) {
						this.circularDependencies.add(path[i]);
					}
				}
				this.circularDependencies.add(name);
				return;
			}

			visiting.add(name);
			path.push(name);

			const deps = dependencies.get(name);
			if (deps) {
				for (const dep of deps) {
					if (dependencies.has(dep)) {
						detectCircular(dep, [...path]);
					}
				}
			}

			visiting.delete(name);
			visited.add(name);
		};

		for (const name of dependencies.keys()) {
			detectCircular(name, []);
		}
	}

	/**
	 * Generate JSDoc warning for allOf conflicts
	 * @param conflicts Array of conflict description strings
	 * @returns JSDoc formatted warning string
	 */
	private generateConflictJSDoc(conflicts: string[]): string {
		const lines = [" * @warning allOf property conflicts detected:"];
		for (const conflict of conflicts) {
			lines.push(` * - ${conflict}`);
		}
		return `${lines.join("\n")}\n`;
	}
}
