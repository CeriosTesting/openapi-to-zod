import { LRUCache, type OpenAPISchema, toCamelCase, toPascalCase } from "@cerios/openapi-core";
import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import { buildDateTimeValidation, PropertyGenerator, type PropertyGeneratorContext } from "@cerios/openapi-to-zod";

/**
 * Information about an inline response schema
 */
export interface InlineSchemaInfo {
	/** Generated schema name (e.g., "GetUsersResponse") */
	schemaName: string;
	/** The raw OpenAPI schema definition */
	schema: OpenAPISchema;
	/** Method name this schema belongs to */
	methodName: string;
	/** HTTP status code */
	statusCode: string;
	/** HTTP method (GET, POST, etc.) */
	httpMethod: string;
	/** API path */
	path: string;
}

/**
 * Information about an inline request schema
 */
export interface InlineRequestSchemaInfo {
	/** Generated schema name (e.g., "PostUsersRequest") */
	schemaName: string;
	/** The raw OpenAPI schema definition */
	schema: OpenAPISchema;
	/** Method name this schema belongs to */
	methodName: string;
	/** Content type (e.g., "application/json") */
	contentType: string;
	/** HTTP method (GET, POST, etc.) */
	httpMethod: string;
	/** API path */
	path: string;
}

/**
 * Options for inline schema generation
 */
export interface InlineSchemaGeneratorOptions {
	spec: OpenAPISpec;
	stripSchemaPrefix?: string | string[];
	prefix?: string;
	suffix?: string;
	defaultNullable?: boolean;
	mode?: "strict" | "normal" | "loose";
	includeDescriptions?: boolean;
	useDescribe?: boolean;
	emptyObjectBehavior?: "strict" | "loose" | "record";
	/** When true, skip generating z.infer type exports (used in separate schemas mode) */
	skipTypeInference?: boolean;
	/**
	 * Whether types are in a separate file from schemas.
	 * When true: Uses z.ZodType<TypeAlias> syntax for schema definitions
	 * When false: Uses z.infer in the same file
	 * @default false
	 */
	separateTypesFile?: boolean;
}

/**
 * Create a PropertyGenerator context for inline schema generation
 */
function createPropertyGeneratorContext(
	options: InlineSchemaGeneratorOptions,
	schemaType: "request" | "response"
): PropertyGeneratorContext {
	return {
		spec: options.spec,
		schemaDependencies: new Map(), // Empty - inline schemas don't track dependencies
		schemaType, // request schemas exclude readOnly, response schemas exclude writeOnly
		mode: options.mode ?? "normal",
		includeDescriptions: options.includeDescriptions ?? false,
		useDescribe: options.useDescribe ?? false,
		namingOptions: {
			prefix: options.prefix,
			suffix: options.suffix,
		},
		stripSchemaPrefix: options.stripSchemaPrefix,
		defaultNullable: options.defaultNullable ?? false,
		emptyObjectBehavior: options.emptyObjectBehavior ?? "loose",
		dateTimeValidation: buildDateTimeValidation(),
		patternCache: new LRUCache<string, string>(100),
		separateTypesFile: options.separateTypesFile ?? false,
	};
}

/**
 * Generate Zod schema code for a single inline schema (response or request)
 * Uses the core PropertyGenerator for full feature parity with component schemas
 */
function generateInlineSchema(
	schemaName: string,
	inlineSchema: OpenAPISchema,
	options: InlineSchemaGeneratorOptions,
	schemaType: "request" | "response"
): { schemaCode: string; typeCode: string; schemaVarName: string } | null {
	if (!inlineSchema) {
		return null;
	}

	const context = createPropertyGeneratorContext(options, schemaType);
	const propertyGenerator = new PropertyGenerator(context);

	try {
		// Generate Zod schema code using the core generator
		const zodCode = propertyGenerator.generatePropertySchema(inlineSchema, undefined, true, false);

		if (!zodCode) {
			return null;
		}

		// Generate schema variable name with prefix/suffix
		const schemaVarName = `${toCamelCase(schemaName, { prefix: options.prefix, suffix: options.suffix })}Schema`;
		// Type name uses PascalCase for proper sanitization (handles path params like {companyId})
		const typeName = toPascalCase(schemaName);

		return {
			schemaCode: `export const ${schemaVarName} = ${zodCode};`,
			// Skip type inference when in separate schemas mode (types come from separate file)
			typeCode: options.skipTypeInference ? "" : `export type ${typeName} = z.infer<typeof ${schemaVarName}>;`,
			schemaVarName,
		};
	} catch (error) {
		console.warn(
			`[openapi-to-zod-playwright] Failed to generate inline schema "${schemaName}": ${error instanceof Error ? error.message : String(error)}`
		);
		return null;
	}
}

/**
 * Generate Zod schema code for a single inline response schema
 * Uses the core PropertyGenerator for full feature parity with component schemas
 */
export function generateInlineResponseSchema(
	schemaName: string,
	inlineSchema: OpenAPISchema,
	options: InlineSchemaGeneratorOptions
): { schemaCode: string; typeCode: string; schemaVarName: string } | null {
	return generateInlineSchema(schemaName, inlineSchema, options, "response");
}

/**
 * Generate Zod schema code for a single inline request schema
 * Uses the core PropertyGenerator for full feature parity with component schemas
 * Request schemas exclude readOnly properties
 */
export function generateInlineRequestSchema(
	schemaName: string,
	inlineSchema: OpenAPISchema,
	options: InlineSchemaGeneratorOptions
): { schemaCode: string; typeCode: string; schemaVarName: string } | null {
	return generateInlineSchema(schemaName, inlineSchema, options, "request");
}

/**
 * Generate all inline response schemas as a single string block
 * Schemas are sorted alphabetically for deterministic output
 * Each schema is immediately followed by its type inference (matching component generation pattern)
 */
export function generateInlineResponseSchemas(
	inlineSchemas: Map<string, InlineSchemaInfo>,
	options: InlineSchemaGeneratorOptions
): string {
	if (inlineSchemas.size === 0) {
		return "";
	}

	const outputBlocks: string[] = [];

	// Sort schemas alphabetically by name for deterministic output
	const sortedEntries = Array.from(inlineSchemas.entries()).sort((a, b) => a[0].localeCompare(b[0]));

	for (const [schemaName, info] of sortedEntries) {
		const result = generateInlineResponseSchema(schemaName, info.schema, options);
		if (result) {
			// Output schema immediately followed by its type (matching component generation pattern)
			outputBlocks.push(result.schemaCode);
			// Only add type code if not in separate schemas mode
			if (result.typeCode) {
				outputBlocks.push(result.typeCode);
			}
			outputBlocks.push(""); // Empty line between schema/type pairs
		}
	}

	if (outputBlocks.length === 0) {
		return "";
	}

	// Remove trailing empty line
	if (outputBlocks[outputBlocks.length - 1] === "") {
		outputBlocks.pop();
	}

	return [
		"// ============================================================================",
		"// Inline Response Schemas",
		"// Generated from responses without $ref",
		"// ============================================================================",
		"",
		...outputBlocks,
	].join("\n");
}

/**
 * Generate all inline request schemas as a single string block
 * Schemas are sorted alphabetically for deterministic output
 * Each schema is immediately followed by its type inference (matching component generation pattern)
 */
export function generateInlineRequestSchemas(
	inlineSchemas: Map<string, InlineRequestSchemaInfo>,
	options: InlineSchemaGeneratorOptions
): string {
	if (inlineSchemas.size === 0) {
		return "";
	}

	const outputBlocks: string[] = [];

	// Sort schemas alphabetically by name for deterministic output
	const sortedEntries = Array.from(inlineSchemas.entries()).sort((a, b) => a[0].localeCompare(b[0]));

	for (const [schemaName, info] of sortedEntries) {
		const result = generateInlineRequestSchema(schemaName, info.schema, options);
		if (result) {
			// Output schema immediately followed by its type (matching component generation pattern)
			outputBlocks.push(result.schemaCode);
			// Only add type code if not in separate schemas mode
			if (result.typeCode) {
				outputBlocks.push(result.typeCode);
			}
			outputBlocks.push(""); // Empty line between schema/type pairs
		}
	}

	if (outputBlocks.length === 0) {
		return "";
	}

	// Remove trailing empty line
	if (outputBlocks[outputBlocks.length - 1] === "") {
		outputBlocks.pop();
	}

	return [
		"// ============================================================================",
		"// Inline Request Schemas",
		"// Generated from request bodies without $ref",
		"// ============================================================================",
		"",
		...outputBlocks,
	].join("\n");
}

/**
 * Generate a request schema name from method name and content type
 * @param methodName - The method name (e.g., "postUsers")
 * @param contentType - The content type (e.g., "application/json")
 * @param hasMultipleContentTypes - Whether there are multiple content types
 * @returns Schema name like "PostUsersRequest" or "PostUsersJsonRequest"
 */
export function generateInlineRequestSchemaName(
	methodName: string,
	contentType: string,
	hasMultipleContentTypes: boolean
): string {
	// Convert methodName to PascalCase for the type name
	const pascalMethodName = methodName.charAt(0).toUpperCase() + methodName.slice(1);

	// Add content type suffix if there are multiple content types
	let contentTypeSuffix = "";
	if (hasMultipleContentTypes) {
		// Convert content type to a usable suffix
		// application/json -> Json
		// application/xml -> Xml
		// multipart/form-data -> FormData
		// application/x-www-form-urlencoded -> FormUrlEncoded
		if (contentType.includes("json")) {
			contentTypeSuffix = "Json";
		} else if (contentType.includes("xml")) {
			contentTypeSuffix = "Xml";
		} else if (contentType.includes("form-data")) {
			contentTypeSuffix = "FormData";
		} else if (contentType.includes("x-www-form-urlencoded")) {
			contentTypeSuffix = "FormUrlEncoded";
		} else {
			// Fallback: use the subtype
			const parts = contentType.split("/");
			if (parts.length > 1) {
				contentTypeSuffix = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).replace(/[^a-zA-Z0-9]/g, "");
			}
		}
	}

	return `${pascalMethodName}${contentTypeSuffix}Request`;
}
