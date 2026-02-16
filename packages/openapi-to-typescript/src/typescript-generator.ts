/**
 * TypeScript Generator
 *
 * Main class for generating TypeScript types from OpenAPI specifications
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, normalize } from "node:path";

import {
	applyFormatting,
	ConfigurationError,
	createFilterStatistics,
	detectCircularReferences,
	expandTransitiveReferences,
	extractSchemaRefs,
	type FilterStatistics,
	formatFilterStatistics,
	generateHeaderParamsTypeName,
	generateInlineRequestTypeName,
	generateInlineResponseTypeName,
	generateQueryParamsTypeName,
	getOperationName,
	loadOpenAPISpec,
	mergeParameters,
	type OpenAPISchema,
	type OpenAPISpec,
	resolveRefName,
	type SchemaContext,
	SchemaGenerationError,
	SpecValidationError,
	shouldIncludeOperation,
	stripPathPrefix,
	stripPrefix,
	topologicalSortSchemas,
	validateFilters,
} from "@cerios/openapi-core";

import { generateEnum } from "./generators/enum-generator";
import { formatTypeProperty, generateTypeDeclaration } from "./generators/type-generator";
import type { TypeScriptGeneratorOptions } from "./types";

/**
 * Strip prefix from name - handles string or string array
 */
function stripSchemaPrefix(name: string, prefixes?: string | string[]): string {
	if (!prefixes) return name;
	const prefixArray = Array.isArray(prefixes) ? prefixes : [prefixes];
	let result = name;
	for (const prefix of prefixArray) {
		result = stripPrefix(result, prefix);
	}
	return result;
}

export class TypeScriptGenerator {
	private generatedTypes: Map<string, string> = new Map();
	private schemaDependencies: Map<string, Set<string>> = new Map();
	private circularSchemas: Set<string> = new Set();
	private options: TypeScriptGeneratorOptions;
	private spec: OpenAPISpec;
	private schemaUsageMap: Map<string, SchemaContext> = new Map();
	private filterStats: FilterStatistics = createFilterStatistics();

	constructor(options: TypeScriptGeneratorOptions) {
		// Validate input path early
		if (!options.input) {
			throw new ConfigurationError("Input path is required", { providedOptions: options });
		}

		this.options = {
			input: options.input,
			outputTypes: options.outputTypes,
			enumFormat: options.enumFormat ?? "const-object",
			includeDescriptions: options.includeDescriptions ?? true,
			defaultNullable: options.defaultNullable ?? false,
			prefix: options.prefix,
			suffix: options.suffix,
			stripSchemaPrefix: options.stripSchemaPrefix,
			stripPathPrefix: options.stripPathPrefix,
			useOperationId: options.useOperationId ?? true,
			operationFilters: options.operationFilters,
			showStats: options.showStats ?? true,
			batchSize: options.batchSize ?? 10,
		};

		// Load and parse the OpenAPI specification using core utility
		this.spec = loadOpenAPISpec(this.options.input);

		this.validateSpec();

		// Detect circular references
		this.circularSchemas = detectCircularReferences(this.spec);

		// Analyze schema usage if operation filters are specified
		if (this.options.operationFilters) {
			this.initializeSchemaUsage();
		}
	}

	/**
	 * Validate the OpenAPI specification
	 */
	private validateSpec(): void {
		if (!this.spec) {
			throw new SpecValidationError("Empty or invalid OpenAPI specification", {
				filePath: this.options.input,
			});
		}

		if (!this.spec.openapi?.startsWith("3.")) {
			throw new SpecValidationError("Only OpenAPI 3.x specifications are supported", {
				filePath: this.options.input,
				version: this.spec.openapi,
			});
		}

		if (!this.spec.components?.schemas) {
			throw new SpecValidationError("No schemas found in OpenAPI spec", {
				filePath: this.options.input,
			});
		}
	}

	/**
	 * Initialize schema usage map with operation filtering
	 */
	private initializeSchemaUsage(): void {
		if (!this.options.operationFilters || !this.spec.paths) {
			return;
		}

		const requestSchemas = new Set<string>();
		const responseSchemas = new Set<string>();

		for (const [path, pathItem] of Object.entries(this.spec.paths)) {
			const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
			for (const method of methods) {
				const operation = (pathItem as Record<string, unknown>)[method];
				if (typeof operation !== "object" || !operation) continue;

				this.filterStats.totalOperations++;

				if (!shouldIncludeOperation(operation, path, method, this.options.operationFilters, this.filterStats)) {
					continue;
				}

				this.filterStats.includedOperations++;
				const op = operation as Record<string, unknown>;

				// Extract request schemas
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

				// Extract response schemas
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

				// Extract parameter schemas
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

		// Expand transitive references (modifies Sets in place)
		expandTransitiveReferences(requestSchemas, this.spec);
		expandTransitiveReferences(responseSchemas, this.spec);

		// Build usage map
		for (const name of requestSchemas) {
			const inResponse = responseSchemas.has(name);
			this.schemaUsageMap.set(name, inResponse ? "both" : "request");
		}
		for (const name of responseSchemas) {
			if (!this.schemaUsageMap.has(name)) {
				this.schemaUsageMap.set(name, "response");
			}
		}
	}

	/**
	 * Check if a schema should be included based on filters
	 */
	private shouldIncludeSchema(name: string): boolean {
		// Check operation filter usage
		if (this.options.operationFilters && this.schemaUsageMap.size > 0) {
			return this.schemaUsageMap.has(name);
		}

		return true;
	}

	/**
	 * Generate TypeScript type for a schema
	 */
	private generateSchemaType(name: string, schema: OpenAPISchema): string {
		const strippedName = stripSchemaPrefix(name, this.options.stripSchemaPrefix);
		const typeName = applyFormatting(strippedName, this.options.prefix, this.options.suffix);

		// Track dependencies
		if (!this.schemaDependencies.has(name)) {
			this.schemaDependencies.set(name, new Set());
		}
		const deps = this.schemaDependencies.get(name) ?? new Set<string>();

		// Handle enum types
		if (schema.enum && Array.isArray(schema.enum)) {
			const { code } = generateEnum(strippedName, schema.enum, {
				format: this.options.enumFormat ?? "union",
				prefix: this.options.prefix,
				suffix: this.options.suffix,
				nullable: schema.nullable === true,
			});

			// Add JSDoc if descriptions are enabled
			if (this.options.includeDescriptions && schema.description) {
				return `/**\n * ${schema.description}\n */\n${code}`;
			}

			return code;
		}

		// Handle allOf (intersection types) - check before object type
		if (schema.allOf && Array.isArray(schema.allOf)) {
			const parts: string[] = [];
			for (const subSchema of schema.allOf) {
				if (subSchema.$ref) {
					const refName = resolveRefName(subSchema.$ref);
					deps.add(refName);
					const strippedRef = stripSchemaPrefix(refName, this.options.stripSchemaPrefix);
					const refTypeName = applyFormatting(strippedRef, this.options.prefix, this.options.suffix);
					parts.push(refTypeName);
				} else if (subSchema.properties) {
					// Inline properties
					const props = this.generateProperties(name, subSchema, deps);
					parts.push(`{ ${props.join("; ")} }`);
				}
			}
			const typeStr = parts.join(" & ");
			const code = `export type ${typeName} = ${typeStr};`;

			if (this.options.includeDescriptions && schema.description) {
				return `/**\n * ${schema.description}\n */\n${code}`;
			}

			return code;
		}

		// Handle oneOf (union types) - check before object type
		if (schema.oneOf && Array.isArray(schema.oneOf)) {
			const parts: string[] = [];
			for (const subSchema of schema.oneOf) {
				if (subSchema.$ref) {
					const refName = resolveRefName(subSchema.$ref);
					deps.add(refName);
					const strippedRef = stripSchemaPrefix(refName, this.options.stripSchemaPrefix);
					const refTypeName = applyFormatting(strippedRef, this.options.prefix, this.options.suffix);
					parts.push(refTypeName);
				} else {
					parts.push(this.schemaToTypeString(subSchema, deps));
				}
			}
			const typeStr = parts.join(" | ");
			const code = `export type ${typeName} = ${typeStr};`;

			if (this.options.includeDescriptions && schema.description) {
				return `/**\n * ${schema.description}\n */\n${code}`;
			}

			return code;
		}

		// Handle anyOf (union types) - check before object type
		if (schema.anyOf && Array.isArray(schema.anyOf)) {
			const parts: string[] = [];
			for (const subSchema of schema.anyOf) {
				if (subSchema.$ref) {
					const refName = resolveRefName(subSchema.$ref);
					deps.add(refName);
					const strippedRef = stripSchemaPrefix(refName, this.options.stripSchemaPrefix);
					const refTypeName = applyFormatting(strippedRef, this.options.prefix, this.options.suffix);
					parts.push(refTypeName);
				} else {
					parts.push(this.schemaToTypeString(subSchema, deps));
				}
			}
			const typeStr = parts.join(" | ");
			const code = `export type ${typeName} = ${typeStr};`;

			if (this.options.includeDescriptions && schema.description) {
				return `/**\n * ${schema.description}\n */\n${code}`;
			}

			return code;
		}

		// Handle object types
		if (schema.type === "object" || schema.properties) {
			const properties = this.generateProperties(name, schema, deps);
			const { code } = generateTypeDeclaration(strippedName, properties, {
				prefix: this.options.prefix,
				suffix: this.options.suffix,
			});

			// Add JSDoc if descriptions are enabled
			if (this.options.includeDescriptions && schema.description) {
				return `/**\n * ${schema.description}\n */\n${code}`;
			}

			return code;
		}

		// Handle array types
		if (schema.type === "array" && schema.items) {
			const itemType = this.schemaToTypeString(schema.items, deps);
			let arrayType = `${itemType}[]`;
			// Handle nullable array type alias
			if (schema.nullable) {
				arrayType = `${arrayType} | null`;
			}
			const code = `export type ${typeName} = ${arrayType};`;

			if (this.options.includeDescriptions && schema.description) {
				return `/**\n * ${schema.description}\n */\n${code}`;
			}

			return code;
		}

		// Handle primitive type aliases
		let typeStr = this.primitiveToTypeString(schema);
		// Handle nullable primitive type alias
		if (schema.nullable) {
			typeStr = `${typeStr} | null`;
		}
		const code = `export type ${typeName} = ${typeStr};`;

		if (this.options.includeDescriptions && schema.description) {
			return `/**\n * ${schema.description}\n */\n${code}`;
		}

		return code;
	}

	/**
	 * Generate properties for an object schema
	 */
	private generateProperties(_schemaName: string, schema: OpenAPISchema, deps: Set<string>): string[] {
		const properties: string[] = [];

		if (!schema.properties) {
			return properties;
		}

		const required = new Set(schema.required || []);

		for (const [propName, propSchema] of Object.entries(schema.properties)) {
			const isRequired = required.has(propName);
			// schemaToTypeString now handles nullable internally
			const typeStr = this.schemaToTypeString(propSchema, deps);

			const prop = formatTypeProperty(propName, typeStr, isRequired);

			// Add JSDoc for property description
			if (this.options.includeDescriptions && propSchema.description) {
				properties.push(`/** ${propSchema.description} */\n  ${prop}`);
			} else {
				properties.push(prop);
			}
		}

		return properties;
	}

	/**
	 * Convert a schema to a TypeScript type string
	 */
	private schemaToTypeString(schema: OpenAPISchema, deps: Set<string>): string {
		// Handle OpenAPI 3.1 type arrays like type: [string, null]
		if (Array.isArray(schema.type)) {
			const types = schema.type as string[];
			const hasNull = types.includes("null");
			const nonNullTypes = types.filter((t: string) => t !== "null");

			if (nonNullTypes.length === 0) {
				return "null";
			}

			// Generate type for each non-null type
			const typeStrings = nonNullTypes.map((t: string) => {
				const tempSchema = { ...schema, type: t };
				return this.schemaToTypeString(tempSchema, deps);
			});

			const baseType = typeStrings.join(" | ");
			return hasNull ? `${baseType} | null` : baseType;
		}

		// Handle $ref
		if (schema.$ref) {
			const refName = resolveRefName(schema.$ref);
			deps.add(refName);
			const strippedRef = stripSchemaPrefix(refName, this.options.stripSchemaPrefix);
			const typeName = applyFormatting(strippedRef, this.options.prefix, this.options.suffix);
			// Handle nullable $ref (e.g., { $ref: '#/...', nullable: true })
			if (schema.nullable) {
				return `${typeName} | null`;
			}
			return typeName;
		}

		// Handle enum
		if (schema.enum && Array.isArray(schema.enum)) {
			const enumType = schema.enum.map(v => (typeof v === "string" ? `"${v}"` : String(v))).join(" | ");
			// Handle nullable enum
			if (schema.nullable) {
				return `${enumType} | null`;
			}
			return enumType;
		}

		// Handle array
		if (schema.type === "array" && schema.items) {
			const itemType = this.schemaToTypeString(schema.items, deps);
			const arrayType = `${itemType}[]`;
			// Handle nullable array
			if (schema.nullable) {
				return `${arrayType} | null`;
			}
			return arrayType;
		}

		// Handle object
		if (schema.type === "object" || schema.properties) {
			let objectType: string;
			if (schema.properties) {
				const props: string[] = [];
				const required = new Set(schema.required || []);
				for (const [propName, propSchema] of Object.entries(schema.properties)) {
					const isRequired = required.has(propName);
					// schemaToTypeString handles nullable internally via recursion
					const typeStr = this.schemaToTypeString(propSchema, deps);
					props.push(formatTypeProperty(propName, typeStr, isRequired));
				}
				objectType = `{ ${props.join("; ")} }`;
			} else if (schema.additionalProperties) {
				// additionalProperties
				if (typeof schema.additionalProperties === "boolean") {
					objectType = "Record<string, unknown>";
				} else {
					const valueType = this.schemaToTypeString(schema.additionalProperties, deps);
					objectType = `Record<string, ${valueType}>`;
				}
			} else {
				objectType = "Record<string, unknown>";
			}
			// Handle nullable object
			if (schema.nullable) {
				return `${objectType} | null`;
			}
			return objectType;
		}

		// Handle allOf
		if (schema.allOf && Array.isArray(schema.allOf)) {
			const parts = schema.allOf.map(s => this.schemaToTypeString(s, deps));
			const baseType = parts.join(" & ");
			// Handle nullable on allOf
			if (schema.nullable) {
				return `${baseType} | null`;
			}
			return baseType;
		}

		// Handle oneOf/anyOf
		if (schema.oneOf && Array.isArray(schema.oneOf)) {
			const parts = schema.oneOf.map(s => this.schemaToTypeString(s, deps));
			const baseType = parts.join(" | ");
			// Handle nullable on oneOf
			if (schema.nullable) {
				return `${baseType} | null`;
			}
			return baseType;
		}
		if (schema.anyOf && Array.isArray(schema.anyOf)) {
			const parts = schema.anyOf.map(s => this.schemaToTypeString(s, deps));
			const baseType = parts.join(" | ");
			// Handle nullable on anyOf
			if (schema.nullable) {
				return `${baseType} | null`;
			}
			return baseType;
		}

		// Handle primitives with nullable
		const primitiveType = this.primitiveToTypeString(schema);
		if (schema.nullable) {
			return `${primitiveType} | null`;
		}
		return primitiveType;
	}

	/**
	 * Convert a primitive schema to a TypeScript type string
	 */
	private primitiveToTypeString(schema: OpenAPISchema): string {
		switch (schema.type) {
			case "string":
				return "string";
			case "integer":
			case "number":
				return "number";
			case "boolean":
				return "boolean";
			case "null":
				return "null";
			default:
				return "unknown";
		}
	}

	/**
	 * Generate statistics
	 */
	private generateStats(): string[] {
		const stats: string[] = [];
		stats.push("/**");
		stats.push(" * TypeScript Types Generation Statistics");
		stats.push(` * Generated from: ${this.options.input}`);
		stats.push(` * Total schemas: ${this.generatedTypes.size}`);

		if (this.circularSchemas.size > 0) {
			stats.push(` * Circular references detected: ${Array.from(this.circularSchemas).join(", ")}`);
		}

		if (this.options.operationFilters) {
			const filterStatsStr = formatFilterStatistics(this.filterStats);
			if (filterStatsStr) {
				stats.push(...filterStatsStr.split("\n").map(s => ` * ${s}`));
			}
		}

		stats.push(" */");
		return stats;
	}

	/**
	 * Topologically sort schemas
	 */
	private topologicalSort(): string[] {
		return topologicalSortSchemas(this.schemaDependencies, this.circularSchemas);
	}

	/**
	 * Generate query parameter types for each operation
	 */
	private generateQueryParamTypes(): void {
		if (!this.spec.paths) return;

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

				// Merge path-level and operation-level parameters
				const allParams = mergeParameters(pathItem.parameters, operation.parameters, this.spec);

				// Filter for query parameters only
				const queryParams = allParams.filter(
					(param: any) => param && typeof param === "object" && param.in === "query"
				);

				if (queryParams.length === 0) continue;

				// Get operation name (with stripPathPrefix applied)
				const strippedPath = stripPathPrefix(path, this.options.stripPathPrefix);
				const operationName = getOperationName(
					operation.operationId,
					method,
					strippedPath,
					this.options.useOperationId
				);
				const typeName = generateQueryParamsTypeName(operationName);

				// Generate properties
				const props: string[] = [];
				for (const param of queryParams) {
					const paramSchema = param.schema;
					if (!paramSchema) continue;

					const deps = new Set<string>();
					const typeStr = this.schemaToTypeString(paramSchema, deps);
					const isRequired = param.required === true;

					let propDef = formatTypeProperty(param.name, typeStr, isRequired);
					if (this.options.includeDescriptions && param.description) {
						propDef = `/** ${param.description} */\n  ${propDef}`;
					}
					props.push(propDef);
				}

				const { code } = generateTypeDeclaration(typeName, props, {
					prefix: this.options.prefix,
					suffix: this.options.suffix,
				});

				// Add JSDoc
				const jsdocOperationName = operation.operationId || `${method.toUpperCase()} ${path}`;
				const jsdoc = `/**\n * Query parameters for ${jsdocOperationName}\n */\n`;
				this.generatedTypes.set(`QueryParams:${typeName}`, `${jsdoc}${code}`);
			}
		}
	}

	/**
	 * Generate header parameter types for each operation
	 */
	private generateHeaderParamTypes(): void {
		if (!this.spec.paths) return;

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

				// Merge path-level and operation-level parameters
				const allParams = mergeParameters(pathItem.parameters, operation.parameters, this.spec);

				// Filter for header parameters only
				const headerParams = allParams.filter(
					(param: any) => param && typeof param === "object" && param.in === "header"
				);

				if (headerParams.length === 0) continue;

				// Get operation name (with stripPathPrefix applied)
				const strippedPath = stripPathPrefix(path, this.options.stripPathPrefix);
				const operationName = getOperationName(
					operation.operationId,
					method,
					strippedPath,
					this.options.useOperationId
				);
				const typeName = generateHeaderParamsTypeName(operationName);

				// Generate properties (headers are always strings)
				const props: string[] = [];
				for (const param of headerParams) {
					let propDef = formatTypeProperty(param.name, "string", false); // Headers always optional
					if (this.options.includeDescriptions && param.description) {
						propDef = `/** ${param.description} */\n  ${propDef}`;
					}
					props.push(propDef);
				}

				const { code } = generateTypeDeclaration(typeName, props, {
					prefix: this.options.prefix,
					suffix: this.options.suffix,
				});

				// Add JSDoc
				const jsdocOperationName = operation.operationId || `${method.toUpperCase()} ${path}`;
				const jsdoc = `/**\n * Header parameters for ${jsdocOperationName}\n */\n`;
				this.generatedTypes.set(`HeaderParams:${typeName}`, `${jsdoc}${code}`);
			}
		}
	}

	/**
	 * Generate inline request body types for each operation
	 */
	private generateInlineRequestTypes(): void {
		if (!this.spec.paths) return;

		for (const [path, pathItem] of Object.entries(this.spec.paths)) {
			if (!pathItem || typeof pathItem !== "object") continue;

			const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

			for (const method of methods) {
				const operation = (pathItem as any)[method];
				if (!operation || !operation.requestBody) continue;

				// Apply operation filters
				if (!shouldIncludeOperation(operation, path, method, this.options.operationFilters)) {
					continue;
				}

				const requestBody = operation.requestBody;
				if (!requestBody.content) continue;

				const contentTypes = Object.keys(requestBody.content);
				const hasMultipleContentTypes = contentTypes.length > 1;

				for (const [contentType, mediaType] of Object.entries(requestBody.content)) {
					const mt = mediaType as { schema?: OpenAPISchema };
					if (!mt.schema) continue;

					// Skip if schema is just a $ref (already generated from components)
					if (mt.schema.$ref) continue;

					// Get operation name (with stripPathPrefix applied)
					const strippedPath = stripPathPrefix(path, this.options.stripPathPrefix);
					const operationName = getOperationName(
						operation.operationId,
						method,
						strippedPath,
						this.options.useOperationId
					);
					const typeName = generateInlineRequestTypeName(operationName, contentType, hasMultipleContentTypes);

					// Generate the type
					const deps = new Set<string>();
					const typeStr = this.schemaToTypeString(mt.schema, deps);
					const code = `export type ${typeName} = ${typeStr};`;

					// Add JSDoc
					const jsdocOperationName = operation.operationId || `${method.toUpperCase()} ${path}`;
					const jsdoc = `/**\n * Request body for ${jsdocOperationName}\n */\n`;
					this.generatedTypes.set(`Request:${typeName}`, `${jsdoc}${code}`);
				}
			}
		}
	}

	/**
	 * Generate inline response types for each operation
	 */
	private generateInlineResponseTypes(): void {
		if (!this.spec.paths) return;

		for (const [path, pathItem] of Object.entries(this.spec.paths)) {
			if (!pathItem || typeof pathItem !== "object") continue;

			const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

			for (const method of methods) {
				const operation = (pathItem as any)[method];
				if (!operation || !operation.responses) continue;

				// Apply operation filters
				if (!shouldIncludeOperation(operation, path, method, this.options.operationFilters)) {
					continue;
				}

				const responses = operation.responses;
				// Only count success status codes (2xx) for hasMultipleStatuses determination
				const successStatusCodes = Object.keys(responses).filter(code => {
					const codeNum = Number.parseInt(code, 10);
					return codeNum >= 200 && codeNum < 300;
				});
				const hasMultipleStatuses = successStatusCodes.length > 1;

				for (const [statusCode, response] of Object.entries(responses)) {
					const resp = response as { content?: Record<string, { schema?: OpenAPISchema }> };
					if (!resp.content) continue;

					// Usually there's one content type per response, but handle multiple
					for (const [_contentType, mediaType] of Object.entries(resp.content)) {
						if (!mediaType.schema) continue;

						// Skip if schema is just a $ref (already generated from components)
						if (mediaType.schema.$ref) continue;

						// Get operation name (with stripPathPrefix applied)
						const strippedPath = stripPathPrefix(path, this.options.stripPathPrefix);
						const operationName = getOperationName(
							operation.operationId,
							method,
							strippedPath,
							this.options.useOperationId
						);
						const typeName = generateInlineResponseTypeName(operationName, statusCode, hasMultipleStatuses);

						// Generate the type
						const deps = new Set<string>();
						const typeStr = this.schemaToTypeString(mediaType.schema, deps);
						const code = `export type ${typeName} = ${typeStr};`;

						// Add JSDoc
						const jsdocOperationName = operation.operationId || `${method.toUpperCase()} ${path}`;
						const jsdoc = `/**\n * Response for ${jsdocOperationName} (${statusCode})\n */\n`;
						this.generatedTypes.set(`Response:${typeName}`, `${jsdoc}${code}`);
					}
				}
			}
		}
	}

	/**
	 * Generate schemas as a string (without writing to file)
	 */
	generateString(): string {
		// Generate types for component schemas (if available)
		if (this.spec.components?.schemas) {
			for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
				if (!this.shouldIncludeSchema(name)) {
					continue;
				}

				try {
					const typeCode = this.generateSchemaType(name, schema);
					this.generatedTypes.set(name, typeCode);
				} catch (error) {
					throw new SchemaGenerationError(`Failed to generate TypeScript type for schema: ${name}`, name, {
						cause: error instanceof Error ? error.message : String(error),
					});
				}
			}
		}

		// Generate inline types from operations
		this.generateQueryParamTypes();
		this.generateHeaderParamTypes();
		this.generateInlineRequestTypes();
		this.generateInlineResponseTypes();

		// Validate filters
		validateFilters(this.filterStats, this.options.operationFilters);

		// Sort schemas by dependencies
		const orderedSchemaNames = this.topologicalSort();

		// Build output
		const output: string[] = [
			"// Auto-generated by @cerios/openapi-to-typescript",
			"// Do not edit this file manually",
			"",
		];

		// Add statistics if enabled
		if (this.options.showStats === true) {
			output.push(...this.generateStats());
			output.push("");
		}

		// Add component types in dependency order
		for (const name of orderedSchemaNames) {
			const typeCode = this.generatedTypes.get(name);
			if (typeCode) {
				output.push(typeCode);
				output.push("");
			}
		}

		// Add inline operation types (query params, header params, request, response)
		const inlineTypes: string[] = [];
		for (const [key, typeCode] of this.generatedTypes.entries()) {
			if (
				key.startsWith("QueryParams:") ||
				key.startsWith("HeaderParams:") ||
				key.startsWith("Request:") ||
				key.startsWith("Response:")
			) {
				inlineTypes.push(typeCode);
			}
		}

		if (inlineTypes.length > 0) {
			output.push("// Operation Types (Query Params, Headers, Request Bodies, Responses)");
			output.push("");
			for (const typeCode of inlineTypes) {
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
	 * Generate and write to file
	 */
	generate(): void {
		if (!this.options.outputTypes) {
			throw new ConfigurationError("Output path is required for generate()", {
				suggestion: "Use generateString() to get output without writing to file",
			});
		}

		const output = this.generateString();
		const normalizedOutput = normalize(this.options.outputTypes);
		this.ensureDirectoryExists(normalizedOutput);
		writeFileSync(normalizedOutput, output);
		console.log(`  ✓ Generated ${normalizedOutput}`);
	}
}
