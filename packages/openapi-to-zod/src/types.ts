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

	/**
	 * Default nullable behavior when not explicitly specified in the schema
	 *
	 * When true: Properties without explicit nullable annotation are treated as nullable.
	 * This follows the industry de facto standard for OpenAPI 3.0.x where tooling convergence
	 * made "nullable by default" the safest assumption.
	 *
	 * When false (default): Properties are only nullable when explicitly marked with `nullable: true`
	 * (OpenAPI 3.0) or `type: ["string", "null"]` (OpenAPI 3.1).
	 *
	 * @default false
	 */
	defaultNullable?: boolean;

	/**
	 * Behavior for empty object schemas (objects with no properties defined)
	 *
	 * - 'strict': Uses z.strictObject({}) - no additional properties allowed
	 * - 'loose': Uses z.looseObject({}) - explicitly allows additional properties (Zod v4)
	 * - 'record': Uses z.record(z.string(), z.unknown()) - treat as arbitrary key-value map
	 *
	 * Note: This option controls nested/property-level empty objects.
	 * The top-level `mode` option controls how schema definitions are wrapped.
	 *
	 * @default 'loose'
	 */
	emptyObjectBehavior?: "strict" | "loose" | "record";
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
	 */
	output: string;

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
	 * Default nullable behavior when not explicitly specified in the schema
	 *
	 * When true: Properties without explicit nullable annotation are treated as nullable.
	 * This follows the industry de facto standard for OpenAPI 3.0.x where tooling convergence
	 * made "nullable by default" the safest assumption.
	 *
	 * When false (default): Properties are only nullable when explicitly marked with `nullable: true`
	 * (OpenAPI 3.0) or `type: ["string", "null"]` (OpenAPI 3.1).
	 *
	 * @default false
	 */
	defaultNullable?: boolean;

	/**
	 * Behavior for empty object schemas (objects with no properties defined)
	 *
	 * - 'strict': Uses z.strictObject({}) - no additional properties allowed
	 * - 'loose': Uses z.looseObject({}) - explicitly allows additional properties (Zod v4)
	 * - 'record': Uses z.record(z.string(), z.unknown()) - treat as arbitrary key-value map
	 *
	 * Note: This option controls nested/property-level empty objects.
	 * The top-level `mode` option controls how schema definitions are wrapped.
	 *
	 * @default 'loose'
	 */
	emptyObjectBehavior?: "strict" | "loose" | "record";

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
	 * Strip a common prefix from all schema names before processing
	 * Useful when OpenAPI spec has redundant schema prefixes that you want to ignore
	 *
	 * Supports both literal strings and glob patterns:
	 * - Literal string: "Company.Models." (must match exactly)
	 * - Glob pattern: "*.Models." (uses minimatch for pattern matching)
	 *
	 * Glob pattern syntax:
	 * - * matches any characters within a single segment (stops at .)
	 * - ** matches any characters across multiple segments (crosses . boundaries)
	 * - ? matches a single character
	 * - [abc] matches any character in the set
	 * - {a,b} matches any of the alternatives
	 * - !(pattern) matches anything except the pattern
	 *
	 * This affects:
	 * - Schema name generation (shorter, cleaner names)
	 * - Type name generation
	 * - References to schemas
	 *
	 * Applied before prefix/suffix options.
	 *
	 * @example
	 * // Spec has: "Company.Models.User", "Company.Models.Post"
	 * // stripSchemaPrefix: "Company.Models."
	 * // Results in: "User", "Post"
	 * // Schema names: userSchema, postSchema
	 *
	 * @example
	 * // Strip any namespace prefix using glob pattern
	 * // stripSchemaPrefix: "*.Models."
	 * // Matches: "Company.Models.User", "App.Models.User", etc.
	 *
	 * @example
	 * // Strip versioned prefix
	 * // stripSchemaPrefix: "api_v[0-9]_"
	 * // Matches: "api_v1_User", "api_v2_Post", etc.
	 *
	 * @default undefined (no stripping)
	 */
	stripSchemaPrefix?: string;

	/**
	 * Whether to include generation statistics in output file
	 * @default true
	 */
	showStats?: boolean;

	/**
	 * Fallback parsing method for unknown or missing content types
	 *
	 * When a content type is not recognized, this determines how the response is parsed:
	 * - "text": Use response.text() - safest, always succeeds (default)
	 * - "json": Use response.json() - may throw if response isn't valid JSON
	 * - "body": Use response.body() - returns raw Buffer
	 *
	 * A warning will be logged during generation when an unknown content type is encountered.
	 *
	 * @default "text"
	 */
	fallbackContentTypeParsing?: "text" | "json" | "body";

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
	 * Strip a common prefix from all paths before generating query/header parameter schema names
	 * This is used when operationId is not available and schema names are derived from the path.
	 *
	 * Supports both literal strings and glob patterns:
	 * - Literal string: "/api/v1" (must match exactly)
	 * - Glob pattern: "/api/v*" (uses minimatch for pattern matching)
	 *
	 * @example
	 * // Path: "/api/v1/users" with stripPathPrefix: "/api/v1"
	 * // Results in: GetUsersQueryParams (not GetApiV1UsersQueryParams)
	 *
	 * @internal Used by Playwright generator
	 * @default undefined (no stripping)
	 */
	stripPathPrefix?: string;

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

	/**
	 * Custom regex pattern for date-time format validation
	 * Overrides the default z.iso.datetime() which requires ISO 8601 format with timezone suffix (Z)
	 *
	 * **Config File Formats:**
	 * - JSON/YAML configs: Must use string pattern (requires double-escaping: `\\d`)
	 * - TypeScript configs: Can use either string pattern OR RegExp literal (`/\d/`)
	 *
	 * **Common Patterns:**
	 * ```typescript
	 * // No timezone suffix (e.g., "2026-01-07T14:30:00")
	 * customDateTimeFormatRegex: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$'
	 * // OR in TypeScript config:
	 * customDateTimeFormatRegex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
	 *
	 * // With milliseconds, no Z (e.g., "2026-01-07T14:30:00.123")
	 * customDateTimeFormatRegex: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}$'
	 *
	 * // Optional Z suffix (e.g., "2026-01-07T14:30:00" or "2026-01-07T14:30:00Z")
	 * customDateTimeFormatRegex: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z?$'
	 * ```
	 *
	 * @default "z.iso.datetime()" (requires Z suffix per ISO 8601)
	 */
	customDateTimeFormatRegex?: string | RegExp;
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
	enum?: (string | number | boolean)[];
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
		parameters?: Record<string, OpenAPIParameter>;
		requestBodies?: Record<string, OpenAPIRequestBody>;
		responses?: Record<string, OpenAPIResponse>;
	};
	paths?: Record<string, any>;
}

/**
 * OpenAPI parameter definition for component parameters
 */
export interface OpenAPIParameter {
	name: string;
	in: "query" | "header" | "path" | "cookie";
	description?: string;
	required?: boolean;
	schema?: OpenAPISchema;
	deprecated?: boolean;
	allowEmptyValue?: boolean;
	style?: string;
	explode?: boolean;
	allowReserved?: boolean;
	example?: any;
	examples?: Record<string, any>;
}

/**
 * OpenAPI request body definition for component request bodies
 */
export interface OpenAPIRequestBody {
	description?: string;
	content?: Record<string, { schema?: OpenAPISchema }>;
	required?: boolean;
	$ref?: string;
}

/**
 * OpenAPI response definition for component responses
 */
export interface OpenAPIResponse {
	description?: string;
	content?: Record<string, { schema?: OpenAPISchema }>;
	headers?: Record<string, { schema?: OpenAPISchema; description?: string }>;
	$ref?: string;
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
