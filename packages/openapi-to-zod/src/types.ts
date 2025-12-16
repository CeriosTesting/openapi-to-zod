/**
 * Common options shared by both request and response contexts
 */
export interface CommonSchemaOptions {
	/**
	 * Object validation mode
	 * - 'strict': Uses z.strictObject() - no additional properties allowed
	 * - 'normal': Uses z.object() - additional properties allowed
	 * - 'loose': Uses z.looseObject() - explicitly allows additional properties
	 */
	mode?: "strict" | "normal" | "loose";

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
 */
export interface RequestOptions extends CommonSchemaOptions {
	// All options inherited from CommonSchemaOptions
}

/**
 * Response-specific options that can override root-level options
 */
export interface ResponseOptions extends CommonSchemaOptions {
	// All options inherited from CommonSchemaOptions
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
	 * Request-specific options that override root-level options
	 * Applied when schemas are used in request contexts
	 */
	request?: RequestOptions;

	/**
	 * Response-specific options that override root-level options
	 * Applied when schemas are used in response contexts
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

	/**
	 * Header parameters to ignore during schema generation
	 * Supports glob patterns for flexible matching
	 * Case-insensitive matching (HTTP header semantics)
	 *
	 * @internal Used by Playwright generator
	 */
	ignoreHeaders?: string[];

	/**
	 * Cache size for pattern regex compilation
	 * Higher values improve performance for large specifications with many string patterns
	 * @default 1000
	 */
	cacheSize?: number;

	/**
	 * Batch size for parallel execution
	 * Controls how many specifications are processed concurrently in parallel mode
	 * Higher values increase memory usage but may improve throughput
	 * @default 10
	 */
	batchSize?: number;
}

/**
 * Operation filtering options
 * Controls which operations from the OpenAPI specification are included in generation
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
 * - 'parallel': Process all specifications concurrently (default, faster)
 * - 'sequential': Process specifications one at a time (safer for resource constraints)
 */
export type ExecutionMode = "parallel" | "sequential";

/**
 * Root configuration file structure
 */
export interface ConfigFile {
	/**
	 * Global default options applied to all specifications
	 * Can be overridden by individual specification configurations
	 */
	defaults?: Partial<Omit<OpenApiGeneratorOptions, "input" | "output">>;

	/**
	 * Array of OpenAPI specifications to process
	 * Each specification must have input and output paths
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
 * All optional fields are required here
 */
export interface ResolvedOptions {
	mode: "strict" | "normal" | "loose";
	useDescribe: boolean;
	includeDescriptions: boolean;
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
