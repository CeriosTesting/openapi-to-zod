/**
 * Core OpenAPI types
 *
 * Shared types for OpenAPI specification parsing and processing
 */

/**
 * Utility type that makes all properties required except the specified keys
 *
 * Useful for creating "resolved options" types where most properties have defaults
 * but some should remain optional (e.g., undefined is a valid resolved state).
 *
 * @example
 * ```typescript
 * interface Options {
 *   input: string;
 *   output: string;
 *   prefix?: string;
 *   suffix?: string;
 * }
 *
 * // input and output are required, prefix and suffix remain optional
 * type ResolvedOptions = RequireExcept<Options, "prefix" | "suffix">;
 * ```
 */
export type RequireExcept<T, K extends keyof T> = Required<Omit<T, K>> & Partial<Pick<T, K>>;

/**
 * OpenAPI schema definition
 */
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

/**
 * OpenAPI specification structure
 */
export interface OpenAPISpec {
	openapi?: string;
	info?: {
		title: string;
		version: string;
		description?: string;
	};
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

/**
 * Base generator options shared across all OpenAPI code generators
 * These options affect how types/schemas are named and processed
 */
export interface BaseGeneratorOptions {
	/**
	 * Path to OpenAPI specification file (YAML or JSON)
	 */
	input: string;

	/**
	 * Output file path for generated types
	 */
	outputTypes: string;

	/**
	 * Include JSDoc comments from schema descriptions
	 * @default true
	 */
	includeDescriptions?: boolean;

	/**
	 * Treat all properties as nullable by default when not explicitly specified
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
	 * Strip a common prefix from all schema names before processing
	 * Useful when OpenAPI spec has redundant schema prefixes that you want to ignore
	 *
	 * Supports both literal strings and glob patterns:
	 * - Literal string: "Company.Models." (must match exactly)
	 * - Glob pattern: "*.Models." (uses minimatch for pattern matching)
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
	 *
	 * @default undefined (no stripping)
	 */
	stripSchemaPrefix?: string | string[];

	/**
	 * Strip a common prefix from all paths before generating operation-derived type names
	 * This is used when operationId is not available, or when useOperationId is false,
	 * and type names are derived from the path.
	 *
	 * Supports both literal strings and glob patterns:
	 * - Literal string: "/api/v1" (must match exactly)
	 * - Glob pattern: "/api/v*" (uses minimatch for pattern matching)
	 *
	 * @example
	 * // Path: "/api/v1/users" with stripPathPrefix: "/api/v1"
	 * // Results in: GetUsersQueryParams (not GetApiV1UsersQueryParams)
	 *
	 * @default undefined (no stripping)
	 */
	stripPathPrefix?: string;

	/**
	 * Whether to use operationId from OpenAPI spec for operation-derived naming
	 *
	 * When true: uses operationId if available, falls back to method+path naming.
	 * When false: always uses method+path naming.
	 *
	 * @default true
	 */
	useOperationId?: boolean;

	/**
	 * Prefix to add to all generated type/schema names
	 * @example "api" -> "ApiUser" or "apiUserSchema"
	 */
	prefix?: string;

	/**
	 * Suffix to add to generated type/schema names
	 * @example "dto" -> "UserDto" or "userDtoSchema"
	 */
	suffix?: string;

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
	 */
	operationFilters?: OperationFilters;

	/**
	 * Show generation statistics in output file
	 * @default true
	 */
	showStats?: boolean;

	/**
	 * Batch size for parallel execution
	 * Controls how many specifications are processed concurrently in parallel mode
	 * Higher values increase memory usage but may improve throughput
	 * @default 10
	 */
	batchSize?: number;
}
