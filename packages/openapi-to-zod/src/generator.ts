import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse } from "yaml";
import { ConfigurationError, FileOperationError, SchemaGenerationError, SpecValidationError } from "./errors";
import { generateEnum } from "./generators/enum-generator";
import { generateJSDoc } from "./generators/jsdoc-generator";
import { PropertyGenerator } from "./generators/property-generator";
import type { GeneratorOptions, OpenAPISchema, OpenAPISpec, ResolvedOptions, TypeMode } from "./types";
import { resolveRef, toCamelCase, toPascalCase } from "./utils/name-utils";

type SchemaContext = "request" | "response" | "both";

export class ZodSchemaGenerator {
	private schemas: Map<string, string> = new Map();
	private types: Map<string, string> = new Map();
	private enums: Map<string, string> = new Map();
	private nativeEnums: Map<string, string> = new Map();
	private schemaDependencies: Map<string, Set<string>> = new Map();
	private options: GeneratorOptions;
	private spec: OpenAPISpec;
	private propertyGenerator: PropertyGenerator;
	private schemaUsageMap: Map<string, SchemaContext> = new Map();
	private schemaTypeModeMap: Map<string, TypeMode> = new Map();
	private requestOptions: ResolvedOptions;
	private responseOptions: ResolvedOptions;
	private needsZodImport = false;

	constructor(options: GeneratorOptions) {
		// Validate input path early
		if (!options.input) {
			throw new ConfigurationError("Input path is required", { providedOptions: options });
		}

		this.options = {
			mode: options.mode || "normal",
			input: options.input,
			output: options.output,
			includeDescriptions: options.includeDescriptions ?? true,
			enumType: options.enumType || "zod",
			useDescribe: options.useDescribe ?? false,
			schemaType: options.schemaType || "all",
			prefix: options.prefix,
			suffix: options.suffix,
			showStats: options.showStats ?? true,
			nativeEnumType: options.nativeEnumType || "union",
			request: options.request,
			response: options.response,
		};

		// Validate input file exists
		try {
			const fs = require("node:fs");
			if (!fs.existsSync(this.options.input)) {
				throw new FileOperationError(`Input file not found: ${this.options.input}`, this.options.input);
			}
		} catch (error) {
			if (error instanceof FileOperationError) {
				throw error;
			}
			// If fs.existsSync fails for another reason, continue and let readFileSync throw
		}

		try {
			const yamlContent = readFileSync(this.options.input, "utf-8");
			this.spec = parse(yamlContent);
		} catch (error) {
			if (error instanceof Error) {
				const errorMessage = [
					`Failed to parse OpenAPI specification from: ${this.options.input}`,
					"",
					`Error: ${error.message}`,
					"",
					"Please ensure:",
					"  - The file exists and is readable",
					"  - The file contains valid YAML syntax",
					"  - The file is a valid OpenAPI 3.x specification",
				].join("\n");
				throw new SpecValidationError(errorMessage, { filePath: this.options.input, originalError: error.message });
			}
			throw error;
		}

		this.validateSpec();

		// Resolve options for request and response contexts
		this.requestOptions = this.resolveOptionsForContext("request");
		this.responseOptions = this.resolveOptionsForContext("response");

		// Analyze schema usage to determine context (request/response/both)
		this.analyzeSchemaUsage();

		// Determine typeMode for each schema based on usage context
		this.determineSchemaTypeModes();

		// Initialize property generator with context
		// We'll update this dynamically based on schema context during generation
		this.propertyGenerator = new PropertyGenerator({
			spec: this.spec,
			schemaDependencies: this.schemaDependencies,
			schemaType: this.options.schemaType || "all",
			mode: this.requestOptions.mode,
			includeDescriptions: this.requestOptions.includeDescriptions,
			useDescribe: this.requestOptions.useDescribe,
			typeMode: this.requestOptions.typeMode,
			nativeEnumType: this.requestOptions.nativeEnumType,
			namingOptions: {
				prefix: this.options.prefix,
				suffix: this.options.suffix,
			},
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

		// First pass: generate enums
		for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
			if (schema.enum) {
				const context = this.schemaUsageMap.get(name);
				const resolvedOptions = context === "response" ? this.responseOptions : this.requestOptions;

				// For enums, use enumType option to determine generation strategy
				if (resolvedOptions.enumType === "typescript") {
					// Generate native TypeScript enum
					this.generateNativeEnum(name, schema);
				} else {
					// Generate Zod enum - will create schema in second pass
					const { enumCode } = generateEnum(name, schema.enum, {
						enumType: "zod",
						prefix: this.options.prefix,
						suffix: this.options.suffix,
					});
					if (enumCode) {
						this.enums.set(name, enumCode);
						// Mark that we need Zod import for enum schemas
						this.needsZodImport = true;
					}
				}
			}
		}

		// Second pass: generate schemas/types and track dependencies
		for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
			this.generateComponentSchema(name, schema);
		}

		// Third pass: generate query parameter schemas from path operations
		this.generateQueryParameterSchemas();

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

		// Add native enums first (they have no dependencies and are referenced by value)
		if (this.nativeEnums.size > 0) {
			output.push("// Native Enums");
			for (const enumCode of this.nativeEnums.values()) {
				output.push(enumCode);
				output.push("");
			}
		}

		// Add schemas, types, and zod enums in dependency order (grouped by schema)
		output.push("// Schemas and Types");
		for (const name of orderedSchemaNames) {
			const enumCode = this.enums.get(name);
			const schemaCode = this.schemas.get(name);
			const typeCode = this.types.get(name);

			if (enumCode) {
				// Zod enum schema
				output.push(enumCode);
				output.push("");
			} else if (schemaCode) {
				// Zod schema with inferred type
				output.push(schemaCode);

				// Add type immediately after schema (if not already included)
				if (!schemaCode.includes(`export type ${name}`)) {
					const schemaName = `${toCamelCase(name, { prefix: this.options.prefix, suffix: this.options.suffix })}Schema`;
					output.push(`export type ${name} = z.infer<typeof ${schemaName}>;`);
				}

				output.push("");
			} else if (typeCode) {
				// Native TypeScript type
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
		const dir = dirname(filePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}

	/**
	 * Generate the complete output file
	 */
	generate(): void {
		if (!this.options.output) {
			throw new ConfigurationError(
				"Output path is required when calling generate(). " +
					"Either provide an 'output' option or use generateString() to get the result as a string.",
				{ hasOutput: false }
			);
		}
		const output = this.generateString();
		this.ensureDirectoryExists(this.options.output);
		writeFileSync(this.options.output, output);
	}

	/**
	 * Resolve options for a specific context (request or response)
	 * Nested options silently override root-level options
	 * Response schemas always use 'inferred' mode (Zod schemas)
	 */
	private resolveOptionsForContext(context: "request" | "response"): ResolvedOptions {
		const contextOptions = context === "request" ? this.options.request : this.options.response;

		return {
			mode: contextOptions?.mode ?? this.options.mode ?? "normal",
			enumType: contextOptions?.enumType ?? this.options.enumType ?? "zod",
			useDescribe: contextOptions?.useDescribe ?? this.options.useDescribe ?? false,
			includeDescriptions: contextOptions?.includeDescriptions ?? this.options.includeDescriptions ?? true,
			// Response schemas always use 'inferred' mode (Zod schemas are required)
			// Request schemas can optionally use 'native' mode
			typeMode: context === "response" ? "inferred" : (contextOptions?.typeMode ?? "inferred"),
			nativeEnumType: contextOptions?.nativeEnumType ?? this.options.nativeEnumType ?? "union",
		};
	}

	/**
	 * Analyze schema usage across the OpenAPI spec to determine if schemas
	 * are used in request, response, or both contexts
	 */
	private analyzeSchemaUsage(): void {
		const requestSchemas = new Set<string>();
		const responseSchemas = new Set<string>();

		// Analyze paths section if available
		if (this.spec.paths) {
			for (const [, pathItem] of Object.entries(this.spec.paths)) {
				for (const [, operation] of Object.entries(pathItem)) {
					if (typeof operation !== "object" || !operation) continue;

					// Check request bodies
					if (
						"requestBody" in operation &&
						operation.requestBody &&
						typeof operation.requestBody === "object" &&
						"content" in operation.requestBody &&
						operation.requestBody.content
					) {
						for (const mediaType of Object.values(operation.requestBody.content)) {
							if (mediaType && typeof mediaType === "object" && "schema" in mediaType && mediaType.schema) {
								this.extractSchemaRefs(mediaType.schema, requestSchemas);
							}
						}
					}

					// Check responses
					if ("responses" in operation && operation.responses && typeof operation.responses === "object") {
						for (const response of Object.values(operation.responses)) {
							if (
								response &&
								typeof response === "object" &&
								"content" in response &&
								response.content &&
								typeof response.content === "object"
							) {
								for (const mediaType of Object.values(response.content)) {
									if (mediaType && typeof mediaType === "object" && "schema" in mediaType && mediaType.schema) {
										this.extractSchemaRefs(mediaType.schema, responseSchemas);
									}
								}
							}
						}
					}

					// Check parameters
					if ("parameters" in operation && Array.isArray(operation.parameters)) {
						for (const param of operation.parameters) {
							if (param && typeof param === "object" && "schema" in param && param.schema) {
								this.extractSchemaRefs(param.schema, requestSchemas);
							}
						}
					}
				}
			}

			// Expand to include all transitively referenced schemas
			this.expandTransitiveReferences(requestSchemas);
			this.expandTransitiveReferences(responseSchemas);
		}

		// Fallback: analyze readOnly/writeOnly properties if paths not available
		if (!this.spec.paths || (requestSchemas.size === 0 && responseSchemas.size === 0)) {
			for (const [name, schema] of Object.entries(this.spec.components?.schemas || {})) {
				const hasReadOnly = this.hasReadOnlyProperties(schema);
				const hasWriteOnly = this.hasWriteOnlyProperties(schema);

				if (hasWriteOnly && !hasReadOnly) {
					requestSchemas.add(name);
				} else if (hasReadOnly && !hasWriteOnly) {
					responseSchemas.add(name);
				}
			}
		}

		// Build usage map with circular reference detection
		for (const [name] of Object.entries(this.spec.components?.schemas || {})) {
			if (requestSchemas.has(name) && responseSchemas.has(name)) {
				this.schemaUsageMap.set(name, "both");
			} else if (requestSchemas.has(name)) {
				this.schemaUsageMap.set(name, "request");
			} else if (responseSchemas.has(name)) {
				this.schemaUsageMap.set(name, "response");
			}
			// Unreferenced schemas are not added to map (will use root typeMode)
		}

		// Detect circular references and mark entire chain as "both"
		this.detectCircularReferences();
	}

	/**
	 * Expand a set of schemas to include all transitively referenced schemas
	 */
	private expandTransitiveReferences(schemas: Set<string>): void {
		const toProcess = Array.from(schemas);
		const processed = new Set<string>();

		while (toProcess.length > 0) {
			const schemaName = toProcess.pop();
			if (!schemaName || processed.has(schemaName)) continue;

			processed.add(schemaName);

			const schema = this.spec.components?.schemas?.[schemaName];
			if (schema) {
				const refs = new Set<string>();
				this.extractSchemaRefs(schema, refs);

				for (const ref of refs) {
					if (!schemas.has(ref)) {
						schemas.add(ref);
						toProcess.push(ref);
					}
				}
			}
		}
	}

	/**
	 * Extract schema names from $ref and nested structures
	 */
	private extractSchemaRefs(schema: any, refs: Set<string>): void {
		if (!schema) return;

		if (schema.$ref) {
			const refName = resolveRef(schema.$ref);
			refs.add(refName);
		}

		if (schema.allOf) {
			for (const subSchema of schema.allOf) {
				this.extractSchemaRefs(subSchema, refs);
			}
		}

		if (schema.oneOf) {
			for (const subSchema of schema.oneOf) {
				this.extractSchemaRefs(subSchema, refs);
			}
		}

		if (schema.anyOf) {
			for (const subSchema of schema.anyOf) {
				this.extractSchemaRefs(subSchema, refs);
			}
		}

		if (schema.items) {
			this.extractSchemaRefs(schema.items, refs);
		}

		if (schema.properties) {
			for (const prop of Object.values(schema.properties)) {
				this.extractSchemaRefs(prop, refs);
			}
		}
	}

	/**
	 * Check if schema has readOnly properties
	 */
	private hasReadOnlyProperties(schema: OpenAPISchema): boolean {
		if (schema.readOnly) return true;
		if (schema.properties) {
			for (const prop of Object.values(schema.properties)) {
				if (this.hasReadOnlyProperties(prop)) return true;
			}
		}
		return false;
	}

	/**
	 * Check if schema has writeOnly properties
	 */
	private hasWriteOnlyProperties(schema: OpenAPISchema): boolean {
		if (schema.writeOnly) return true;
		if (schema.properties) {
			for (const prop of Object.values(schema.properties)) {
				if (this.hasWriteOnlyProperties(prop)) return true;
			}
		}
		return false;
	}

	/**
	 * Detect circular references and mark them as "both" context for safety
	 */
	private detectCircularReferences(): void {
		const visited = new Set<string>();
		const recursionStack = new Set<string>();

		const detectCycle = (name: string): boolean => {
			if (recursionStack.has(name)) {
				// Found a cycle - mark all schemas in the cycle as "both"
				return true;
			}

			if (visited.has(name)) {
				return false;
			}

			visited.add(name);
			recursionStack.add(name);

			const schema = this.spec.components?.schemas?.[name];
			if (schema) {
				const refs = new Set<string>();
				this.extractSchemaRefs(schema, refs);

				for (const ref of refs) {
					if (detectCycle(ref)) {
						// Mark this schema as "both" since it's part of a circular chain
						this.schemaUsageMap.set(name, "both");
						recursionStack.delete(name);
						return true;
					}
				}
			}

			recursionStack.delete(name);
			return false;
		};

		for (const name of Object.keys(this.spec.components?.schemas || {})) {
			detectCycle(name);
		}
	}

	/**
	 * Determine the typeMode for each schema based on its usage context
	 * Response schemas always use 'inferred' mode
	 */
	private determineSchemaTypeModes(): void {
		for (const [name] of Object.entries(this.spec.components?.schemas || {})) {
			const context = this.schemaUsageMap.get(name);

			if (context === "request") {
				this.schemaTypeModeMap.set(name, this.requestOptions.typeMode);
			} else if (context === "response") {
				// Response schemas always use 'inferred' mode (Zod schemas are required)
				this.schemaTypeModeMap.set(name, "inferred");
			} else if (context === "both") {
				// Safety: always use inferred for schemas used in both contexts
				this.schemaTypeModeMap.set(name, "inferred");
			} else {
				// Unreferenced schemas default to inferred
				this.schemaTypeModeMap.set(name, "inferred");
			}

			// Track if we need Zod import
			if (this.schemaTypeModeMap.get(name) === "inferred") {
				this.needsZodImport = true;
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
			const refName = resolveRef(schema.$ref);
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

		// Get the typeMode for this schema
		const typeMode = this.schemaTypeModeMap.get(name) || "inferred";
		const context = this.schemaUsageMap.get(name);
		const resolvedOptions = context === "response" ? this.responseOptions : this.requestOptions;

		// Handle enums at the top level
		if (schema.enum) {
			const jsdoc = generateJSDoc(schema, name, { includeDescriptions: resolvedOptions.includeDescriptions });

			// Use enumType to determine generation strategy
			if (resolvedOptions.enumType === "typescript") {
				// TypeScript enum - native enum was generated in first pass, now generate schema
				const { schemaCode, typeCode } = generateEnum(name, schema.enum, {
					enumType: "typescript",
					prefix: this.options.prefix,
					suffix: this.options.suffix,
				});

				const enumSchemaCode = `${jsdoc}${schemaCode}\n${typeCode}`;
				this.schemas.set(name, enumSchemaCode);
			} else {
				// Zod enum
				const { enumCode, schemaCode, typeCode } = generateEnum(name, schema.enum, {
					enumType: "zod",
					prefix: this.options.prefix,
					suffix: this.options.suffix,
				});

				if (enumCode) {
					this.enums.set(name, enumCode);
				}

				const enumSchemaCode = `${jsdoc}${schemaCode}\n${typeCode}`;
				this.schemas.set(name, enumSchemaCode);
			}
			return;
		}

		if (typeMode === "native") {
			// Generate native TypeScript type
			const jsdoc = generateJSDoc(schema, name, { includeDescriptions: resolvedOptions.includeDescriptions });
			const jsdocWithConstraints = this.addConstraintsToJSDoc(jsdoc, schema, resolvedOptions.includeDescriptions);
			const typeDefinition = this.generateNativeTypeDefinition(schema, name);
			const typeCode = `${jsdocWithConstraints}export type ${name} = ${typeDefinition};`;
			this.types.set(name, typeCode);
		} else {
			// Generate Zod schema
			const schemaName = `${toCamelCase(name, { prefix: this.options.prefix, suffix: this.options.suffix })}Schema`;
			const jsdoc = generateJSDoc(schema, name, { includeDescriptions: resolvedOptions.includeDescriptions });

			// For allOf with single $ref, track dependency manually since we simplify it
			if (schema.allOf && schema.allOf.length === 1 && schema.allOf[0].$ref) {
				const refName = resolveRef(schema.allOf[0].$ref);
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
				typeMode: resolvedOptions.typeMode,
				nativeEnumType: resolvedOptions.nativeEnumType,
				namingOptions: {
					prefix: this.options.prefix,
					suffix: this.options.suffix,
				},
			});

			// Check if this is just a simple $ref (alias)
			const isAlias = !!(schema.$ref && !schema.properties && !schema.allOf && !schema.oneOf && !schema.anyOf);
			const zodSchema = this.propertyGenerator.generatePropertySchema(schema, name, isAlias);
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
	}

	/**
	 * Generate query parameter schemas for each operation
	 */
	private generateQueryParameterSchemas(): void {
		if (!this.spec.paths) {
			return;
		}

		for (const [_path, pathItem] of Object.entries(this.spec.paths)) {
			if (!pathItem || typeof pathItem !== "object") continue;

			const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

			for (const method of methods) {
				const operation = (pathItem as any)[method];
				if (!operation) continue;

				// Skip operations without operationId or parameters
				if (!operation.operationId || !operation.parameters || !Array.isArray(operation.parameters)) {
					continue;
				}

				// Filter for query parameters only
				const queryParams = operation.parameters.filter(
					(param: any) => param && typeof param === "object" && param.in === "query"
				);

				if (queryParams.length === 0) {
					continue;
				}

				// Generate schema name from operationId
				// Use toPascalCase only for kebab-case IDs, simple capitalization for camelCase
				const pascalOperationId = operation.operationId.includes("-")
					? toPascalCase(operation.operationId)
					: operation.operationId.charAt(0).toUpperCase() + operation.operationId.slice(1);
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
						const refName = resolveRef(paramSchema.$ref);
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

				const schemaCode = `z.${zodMethod}({\n${propsCode}\n})`; // Apply prefix/suffix to the operation name only, then add QueryParams and Schema
				const operationName = pascalOperationId; // Already PascalCase
				const prefixedName = this.options.prefix
					? `${toPascalCase(this.options.prefix)}${operationName}`
					: operationName;
				const suffixedName = this.options.suffix ? `${prefixedName}${toPascalCase(this.options.suffix)}` : prefixedName;
				const camelCaseSchemaName = `${suffixedName.charAt(0).toLowerCase() + suffixedName.slice(1)}QueryParamsSchema`;

				// Generate JSDoc
				const jsdoc = `/**\n * Query parameters for ${operation.operationId}\n */\n`;
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
			const refName = resolveRef(schema.$ref);
			const schemaName = toCamelCase(refName, { prefix: this.options.prefix, suffix: this.options.suffix });
			return `${schemaName}Schema`;
		}

		// Handle enums
		if (schema.enum) {
			const enumValues = schema.enum.map(v => (typeof v === "string" ? `"${v}"` : v)).join(", ");
			return `z.enum([${enumValues}])`;
		}

		// Handle primitive types
		const type = schema.type;

		if (type === "string") {
			let zodType = "z.string()";
			// Add string validations
			if (schema.minLength !== undefined) zodType = `${zodType}.min(${schema.minLength})`;
			if (schema.maxLength !== undefined) zodType = `${zodType}.max(${schema.maxLength})`;
			if (schema.pattern) zodType = `${zodType}.regex(/${schema.pattern}/)`;
			if (schema.format === "email") zodType = `${zodType}.email()`;
			if (schema.format === "uri" || schema.format === "url") zodType = `${zodType}.url()`;
			if (schema.format === "uuid") zodType = `${zodType}.uuid()`;
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
	 * Generate native TypeScript enum
	 */
	private generateNativeEnum(name: string, schema: OpenAPISchema): void {
		if (!schema.enum) return;

		const context = this.schemaUsageMap.get(name);
		const resolvedOptions = context === "response" ? this.responseOptions : this.requestOptions;
		const jsdoc = generateJSDoc(schema, name, { includeDescriptions: resolvedOptions.includeDescriptions });

		if (resolvedOptions.nativeEnumType === "enum") {
			// Generate TypeScript enum with Enum suffix (no prefix/suffix)
			const enumName = `${name}Enum`;
			const members = schema.enum
				.map(value => {
					const key = typeof value === "string" ? this.toEnumKey(value) : `N${value}`;
					const val = typeof value === "string" ? `"${value}"` : value;
					return `  ${key} = ${val}`;
				})
				.join(",\n");

			const enumCode = `${jsdoc}export enum ${enumName} {\n${members}\n}`;
			this.nativeEnums.set(name, enumCode);

			// Also create a type alias for convenience
			const typeCode = `export type ${name} = ${enumName};`;
			this.types.set(name, typeCode);
		} else {
			// Generate union type
			const unionType = schema.enum.map(v => (typeof v === "string" ? `"${v}"` : v)).join(" | ");
			const typeCode = `${jsdoc}export type ${name} = ${unionType};`;
			this.types.set(name, typeCode);
		}
	}

	/**
	 * Convert string to valid enum key
	 */
	private toEnumKey(value: string): string {
		// Convert to PascalCase and ensure it starts with a letter
		const cleaned = value.replace(/[^a-zA-Z0-9]/g, "_");
		const pascalCase = cleaned
			.split("_")
			.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
			.join("");
		return pascalCase || "Value";
	}

	/**
	 * Add constraint annotations to JSDoc for native types
	 */
	private addConstraintsToJSDoc(jsdoc: string, schema: OpenAPISchema, includeDescriptions: boolean): string {
		if (!includeDescriptions) return jsdoc;

		const constraints: string[] = [];

		if (schema.minLength !== undefined) constraints.push(`@minLength ${schema.minLength}`);
		if (schema.maxLength !== undefined) constraints.push(`@maxLength ${schema.maxLength}`);
		if (schema.pattern) constraints.push(`@pattern ${schema.pattern}`);
		if (schema.minimum !== undefined) constraints.push(`@minimum ${schema.minimum}`);
		if (schema.maximum !== undefined) constraints.push(`@maximum ${schema.maximum}`);
		if (schema.minItems !== undefined) constraints.push(`@minItems ${schema.minItems}`);
		if (schema.maxItems !== undefined) constraints.push(`@maxItems ${schema.maxItems}`);
		if (schema.minProperties !== undefined) constraints.push(`@minProperties ${schema.minProperties}`);
		if (schema.maxProperties !== undefined) constraints.push(`@maxProperties ${schema.maxProperties}`);
		if (schema.multipleOf !== undefined) constraints.push(`@multipleOf ${schema.multipleOf}`);
		if (schema.format) constraints.push(`@format ${schema.format}`);

		if (constraints.length === 0) return jsdoc;

		// If there's already a JSDoc, add constraints to it
		if (jsdoc) {
			const lines = jsdoc.trim().split("\n");
			if (lines[0] === "/**" && lines[lines.length - 1] === " */") {
				// Multi-line JSDoc
				const newLines = [...lines.slice(0, -1), ...constraints.map(c => ` * ${c}`), " */\n"];
				return newLines.join("\n");
			}
			// Single-line JSDoc
			const content = jsdoc.replace("/** ", "").replace(" */\n", "");
			return `/**\n * ${content}\n${constraints.map(c => ` * ${c}`).join("\n")}\n */\n`;
		}

		// No existing JSDoc, create new one with just constraints
		return `/**\n${constraints.map(c => ` * ${c}`).join("\n")}\n */\n`;
	}

	/**
	 * Generate native TypeScript type definition from OpenAPI schema
	 */
	private generateNativeTypeDefinition(schema: OpenAPISchema, _schemaName?: string): string {
		// Handle $ref
		if (schema.$ref) {
			return resolveRef(schema.$ref);
		}

		// Handle const
		if (schema.const !== undefined) {
			return typeof schema.const === "string" ? `"${schema.const}"` : String(schema.const);
		}

		// Handle nullable
		const isNullable = schema.nullable || (Array.isArray(schema.type) && schema.type.includes("null"));
		const wrapNullable = (type: string) => (isNullable ? `(${type}) | null` : type);

		// Get primary type
		const primaryType = Array.isArray(schema.type) ? schema.type.find(t => t !== "null") : schema.type;

		// Handle different types
		switch (primaryType) {
			case "string":
				return wrapNullable("string");
			case "number":
			case "integer":
				return wrapNullable("number");
			case "boolean":
				return wrapNullable("boolean");
			case "array":
				if (schema.items) {
					const itemType = this.generateNativeTypeDefinition(schema.items);
					return wrapNullable(`${itemType}[]`);
				}
				return wrapNullable("unknown[]");
			case "object":
				return wrapNullable(this.generateObjectType(schema));
			default:
				// Handle composition schemas
				if (schema.allOf) {
					const types = schema.allOf.map(s => this.generateNativeTypeDefinition(s));
					return wrapNullable(types.join(" & "));
				}
				if (schema.oneOf || schema.anyOf) {
					const schemas = schema.oneOf || schema.anyOf || [];
					const types = schemas.map(s => this.generateNativeTypeDefinition(s));
					return wrapNullable(types.join(" | "));
				}
				return wrapNullable("unknown");
		}
	}

	/**
	 * Generate TypeScript object type definition
	 */
	private generateObjectType(schema: OpenAPISchema): string {
		if (!schema.properties || Object.keys(schema.properties).length === 0) {
			return "Record<string, unknown>";
		}

		const context = this.schemaUsageMap.get(schema.$ref ? resolveRef(schema.$ref) : "");
		const resolvedOptions = context === "response" ? this.responseOptions : this.requestOptions;
		const required = new Set(schema.required || []);
		const props: string[] = [];

		for (const [propName, propSchema] of Object.entries(schema.properties)) {
			const propType = this.generateNativeTypeDefinition(propSchema);
			const optional = !required.has(propName) ? "?" : "";

			// Generate JSDoc with constraints
			let propJsdoc = generateJSDoc(propSchema, propName, { includeDescriptions: resolvedOptions.includeDescriptions });
			if (resolvedOptions.includeDescriptions && !propJsdoc) {
				// Add constraint-only JSDoc if no description exists
				propJsdoc = this.addConstraintsToJSDoc("", propSchema, resolvedOptions.includeDescriptions);
			} else if (propJsdoc && resolvedOptions.includeDescriptions) {
				// Add constraints to existing JSDoc
				propJsdoc = this.addConstraintsToJSDoc(propJsdoc, propSchema, resolvedOptions.includeDescriptions);
			}

			if (propJsdoc) {
				// Remove trailing newline for inline property JSDoc
				const cleanJsdoc = propJsdoc.trimEnd();
				props.push(`  ${cleanJsdoc}\n  ${propName}${optional}: ${propType};`);
			} else {
				props.push(`  ${propName}${optional}: ${propType};`);
			}
		}

		return `{\n${props.join("\n")}\n}`;
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
		for (const [name, code] of this.enums) {
			codeCache.set(name, code);
		}
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
			if (deps && deps.size > 0) {
				for (const dep of deps) {
					if (this.enums.has(dep) || this.schemas.has(dep) || this.types.has(dep)) {
						visit(dep);
					}
				}
			}

			visiting.delete(name);
			visited.add(name);

			// Don't add circular dependencies yet - they need special handling
			if (!circularDeps.has(name)) {
				sorted.push(name);
			}
		};

		// Visit all enums, schemas and types
		const allNames = new Set([...this.enums.keys(), ...this.schemas.keys(), ...this.types.keys()]);
		for (const name of allNames) {
			visit(name);
		}

		// Add circular dependencies at the end (before aliases)
		// This ensures they come after their non-circular dependencies
		for (const name of circularDeps) {
			if (!visited.has(name)) {
				sorted.push(name);
				visited.add(name);
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
			enums: this.enums.size,
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

		return [
			"// Generation Statistics:",
			`//   Total schemas: ${stats.totalSchemas}`,
			`//   Enums: ${stats.enums}`,
			`//   Circular references: ${stats.withCircularRefs}`,
			`//   Discriminated unions: ${stats.withDiscriminators}`,
			`//   With constraints: ${stats.withConstraints}`,
			`//   Generated at: ${new Date().toISOString()}`,
		];
	}
}
