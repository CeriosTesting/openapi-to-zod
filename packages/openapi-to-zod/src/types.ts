/**
 * Type generation mode
 * - 'inferred': Generate Zod schemas with z.infer<typeof schema> types (default)
 * - 'native': Generate native TypeScript types without Zod schemas
 */
export type TypeMode = "inferred" | "native";

/**
 * Native enum generation type (used when typeMode is 'native')
 * - 'union': Generate union types like 'a' | 'b' | 'c' (default)
 * - 'enum': Generate TypeScript enums like enum StatusEnum { A = 'a', B = 'b' }
 */
export type NativeEnumType = "union" | "enum";

/**
 * Common options shared by both request and response contexts
 */
interface CommonSchemaOptions {
	/**
	 * Object validation mode
	 * - 'strict': Uses z.strictObject() - no additional properties allowed
	 * - 'normal': Uses z.object() - additional properties allowed
	 * - 'loose': Uses z.looseObject() - explicitly allows additional properties
	 */
	mode?: "strict" | "normal" | "loose";

	/**
	 * Enum generation type
	 * - 'zod': Uses z.enum() with inferred types (default)
	 * - 'typescript': Uses TypeScript enums with z.enum() referencing them
	 */
	enumType?: "zod" | "typescript";

	/**
	 * Whether to add .describe() calls for better error messages
	 * @default false
	 */
	useDescribe?: boolean;

	/**
	 * Whether to include descriptions as JSDoc comments
	 */
	includeDescriptions?: boolean;
}

/**
 * Request-specific options that can override root-level options
 * Requests support native TypeScript type generation as an alternative to Zod schemas
 */
export interface RequestOptions extends CommonSchemaOptions {
	/**
	 * Type generation mode
	 * - 'inferred': Generate Zod schemas with z.infer types (default)
	 * - 'native': Generate native TypeScript types without Zod validation
	 */
	typeMode?: TypeMode;

	/**
	 * Native enum generation type (when typeMode is 'native')
	 * - 'union': Generate union types (default)
	 * - 'enum': Generate TypeScript enums
	 */
	nativeEnumType?: NativeEnumType;
}

/**
 * Response-specific options that can override root-level options
 * Responses always use Zod schemas for runtime validation
 */
export interface ResponseOptions extends CommonSchemaOptions {
	// Responses don't support typeMode - always generate Zod schemas
}

export interface OpenApiGeneratorOptions {
	/**
	 * Object validation mode
	 * - 'strict': Uses z.strictObject() - no additional properties allowed
	 * - 'normal': Uses z.object() - additional properties allowed
	 * - 'loose': Uses z.looseObject() - explicitly allows additional properties
	 */
	mode?: "strict" | "normal" | "loose";

	/**
	 * Input OpenAPI YAML file path
	 */
	input: string;

	/**
	 * Output TypeScript file path
	 * Optional when using string generation methods (generateString)
	 * Required when calling generate() to write to a file
	 */
	output?: string;

	/**
	 * Whether to include descriptions as JSDoc comments
	 */
	includeDescriptions?: boolean;

	/**
	 * Enum generation type
	 * - 'zod': Uses z.enum() with inferred types (default)
	 * - 'typescript': Uses TypeScript enums with z.enum() referencing them
	 */
	enumType?: "zod" | "typescript";

	/**
	 * Whether to add .describe() calls for better error messages
	 * @default false
	 */
	useDescribe?: boolean;

	/**
	 * Schema filtering mode
	 * - 'all': Generate all schemas (default)
	 * - 'request': Only include schemas suitable for requests (excludes readOnly)
	 * - 'response': Only include schemas suitable for responses (excludes writeOnly)
	 */
	schemaType?: "all" | "request" | "response";

	/**
	 * Prefix to add to all generated schema names
	 * @example "api" -> "apiUserSchema"
	 */
	prefix?: string;

	/**
	 * Suffix to add before "Schema" in generated names
	 * @example "dto" -> "userDtoSchema"
	 */
	suffix?: string;

	/**
	 * Whether to include generation statistics in output file
	 * @default true
	 */
	showStats?: boolean;

	/**
	 * Native enum generation type (when typeMode is 'native')
	 * - 'union': Generate union types (default)
	 * - 'enum': Generate TypeScript enums with 'Enum' suffix
	 * @default 'union'
	 */
	nativeEnumType?: NativeEnumType;

	/**
	 * Request-specific options that override root-level options
	 * Applied when schemas are used in request contexts
	 * Supports native TypeScript type generation
	 */
	request?: RequestOptions;

	/**
	 * Response-specific options that override root-level options
	 * Applied when schemas are used in response contexts
	 * Always generates Zod schemas for runtime validation
	 */
	response?: ResponseOptions;

	/**
	 * Filter which operations to include/exclude from generation
	 * Useful for generating separate schemas for different API subsets
	 *
	 * Filtering logic:
	 * 1. If no filters specified, all operations are included
	 * 2. Empty arrays are treated as "no constraint" (not as "exclude all")
	 * 3. Include filters are applied first (allowlist)
	 * 4. Exclude filters are applied second (blocklist)
	 * 5. Exclude rules always win over include rules
	 *
	 * Supports glob patterns for paths and operationIds (e.g., "/api/v1/**", "get*")
	 *
	 * @example
	 * // Only generate schemas for user-related endpoints
	 * operationFilters: {
	 *   includeTags: ["users"]
	 * }
	 *
	 * @example
	 * // Generate only GET endpoints, excluding deprecated ones
	 * operationFilters: {
	 *   includeMethods: ["get"],
	 *   excludeDeprecated: true
	 * }
	 *
	 * @example
	 * // Generate only v1 API endpoints
	 * operationFilters: {
	 *   includePaths: ["/api/v1/**"]
	 * }
	 */
	operationFilters?: OperationFilters;
}

/**
 * Operation filtering options
 * Controls which operations from the OpenAPI spec are included in generation
 */
export interface OperationFilters {
	/**
	 * Include only operations with these tags
	 * If specified, only operations with at least one matching tag are included
	 * Empty array = no constraint
	 */
	includeTags?: string[];

	/**
	 * Exclude operations with these tags
	 * Operations with any matching tag are excluded
	 * Empty array = no constraint
	 */
	excludeTags?: string[];

	/**
	 * Include only operations matching these path patterns
	 * Supports glob patterns (e.g., "/users/**", "/api/v1/*")
	 * Empty array = no constraint
	 */
	includePaths?: string[];

	/**
	 * Exclude operations matching these path patterns
	 * Supports glob patterns (e.g., "/internal/**", "/admin/*")
	 * Empty array = no constraint
	 */
	excludePaths?: string[];

	/**
	 * Include only these HTTP methods
	 * Valid values: "get", "post", "put", "patch", "delete", "head", "options"
	 * Empty array = no constraint
	 */
	includeMethods?: string[];

	/**
	 * Exclude these HTTP methods
	 * Valid values: "get", "post", "put", "patch", "delete", "head", "options"
	 * Empty array = no constraint
	 */
	excludeMethods?: string[];

	/**
	 * Include only operations matching these operationId patterns
	 * Supports glob patterns (e.g., "getUser*", "*Admin")
	 * Empty array = no constraint
	 */
	includeOperationIds?: string[];

	/**
	 * Exclude operations matching these operationId patterns
	 * Supports glob patterns (e.g., "deleteUser*", "*Internal")
	 * Empty array = no constraint
	 */
	excludeOperationIds?: string[];

	/**
	 * Whether to exclude deprecated operations
	 * @default false
	 */
	excludeDeprecated?: boolean;
}

export interface OpenAPISchema {
	type?: string | string[];
	format?: string;
	enum?: (string | number)[];
	const?: string | number | boolean | null;
	properties?: Record<string, OpenAPISchema>;
	required?: string[];
	items?: OpenAPISchema;
	prefixItems?: OpenAPISchema[];
	allOf?: OpenAPISchema[];
	oneOf?: OpenAPISchema[];
	anyOf?: OpenAPISchema[];
	$ref?: string;
	nullable?: boolean;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: boolean | number;
	exclusiveMaximum?: boolean | number;
	multipleOf?: number;
	pattern?: string;
	description?: string;
	title?: string;
	example?: any;
	examples?: any[];
	additionalProperties?: boolean | OpenAPISchema;
	minProperties?: number;
	maxProperties?: number;
	minItems?: number;
	maxItems?: number;
	uniqueItems?: boolean;
	contains?: OpenAPISchema;
	minContains?: number;
	maxContains?: number;
	discriminator?: {
		propertyName: string;
		mapping?: Record<string, string>;
	};
	readOnly?: boolean;
	writeOnly?: boolean;
	deprecated?: boolean;
	dependentRequired?: Record<string, string[]>;
	dependencies?: Record<string, string[] | OpenAPISchema>;
	patternProperties?: Record<string, OpenAPISchema>;
	propertyNames?: OpenAPISchema;
	contentMediaType?: string;
	contentEncoding?: string;
	not?: OpenAPISchema;
	if?: OpenAPISchema;
	then?: OpenAPISchema;
	else?: OpenAPISchema;
	unevaluatedProperties?: boolean | OpenAPISchema;
	unevaluatedItems?: boolean | OpenAPISchema;
}

export interface OpenAPISpec {
	components?: {
		schemas?: Record<string, OpenAPISchema>;
	};
	paths?: Record<string, any>;
}

/**
 * Execution mode for batch processing
 * - 'parallel': Process all specs concurrently (default, faster)
 * - 'sequential': Process specs one at a time (safer for resource constraints)
 */
export type ExecutionMode = "parallel" | "sequential";

/**
 * Root configuration file structure
 */
export interface ConfigFile {
	/**
	 * Global default options applied to all specs
	 * Can be overridden by individual spec configurations
	 */
	defaults?: Partial<Omit<OpenApiGeneratorOptions, "input" | "output">>;

	/**
	 * Array of OpenAPI specifications to process
	 * Each spec must have input and output paths
	 */
	specs: OpenApiGeneratorOptions[];

	/**
	 * Execution mode for batch processing
	 * @default "parallel"
	 */
	executionMode?: ExecutionMode;
}

/**
 * Resolved options for a specific schema context (request or response)
 * All optional fields from RequestResponseOptions are required here
 */
export interface ResolvedOptions {
	mode: "strict" | "normal" | "loose";
	enumType: "zod" | "typescript";
	useDescribe: boolean;
	includeDescriptions: boolean;
	typeMode: TypeMode;
	nativeEnumType: NativeEnumType;
}

/**
 * Helper function for type-safe config file creation
 * Provides IDE autocomplete and type checking for config files
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@cerios/openapi-to-zod';
 *
 * export default defineConfig({
 *   defaults: {
 *     mode: 'strict',
 *     includeDescriptions: true
 *   },
 *   specs: [
 *     { input: 'api-v1.yaml', output: 'schemas/v1.ts' },
 *     { input: 'api-v2.yaml', output: 'schemas/v2.ts', mode: 'normal' }
 *   ]
 * });
 * ```
 */
export function defineConfig(config: ConfigFile): ConfigFile {
	return config;
}
