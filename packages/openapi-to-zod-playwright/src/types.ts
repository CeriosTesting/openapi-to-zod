import type { OpenApiGeneratorOptions, OperationFilters } from "@cerios/openapi-to-zod";

/**
 * Zod error formatting options for service validation
 * - "standard": Uses schema.parseAsync() - throws ZodError directly (default)
 * - "prettify": Uses z.prettifyError() for human-readable messages
 * - "prettifyWithValues": Includes actual values in error messages for debugging
 */
export type ZodErrorFormat = "standard" | "prettify" | "prettifyWithValues";

/**
 * Playwright-specific operation filtering options
 * Extends base filters with status code filtering for response validation
 */
export interface PlaywrightOperationFilters extends OperationFilters {
	/**
	 * Include only these status codes in generated response types
	 * Supports exact codes ("200", "201") and range patterns ("2xx", "4xx", "5xx")
	 * Empty array = no constraint
	 *
	 * @example ["200", "201"] - Only success codes
	 * @example ["2xx"] - All 2xx success codes
	 * @example ["200", "4xx"] - Specific code plus range
	 */
	includeStatusCodes?: string[];

	/**
	 * Exclude these status codes from generated response types
	 * Supports exact codes ("500", "503") and range patterns ("5xx")
	 * Empty array = no constraint
	 *
	 * @example ["5xx"] - Exclude all server errors
	 * @example ["404", "500"] - Exclude specific errors
	 */
	excludeStatusCodes?: string[];
}

/**
 * Generator options for Playwright client generation
 *
 * File Splitting Architecture:
 * - Types (outputTypes): TypeScript type definitions
 * - Schemas (outputZodSchemas): Optional, Zod schemas with z.ZodType<TypeAlias> syntax (when specified)
 * - Combined (outputTypes without outputZodSchemas): Zod schemas + inferred TypeScript types
 * - Client (outputClient): Playwright API passthrough wrapper
 * - Service (outputService): Optional, type-safe validation layer
 */
export interface OpenApiPlaywrightGeneratorOptions extends Omit<
	OpenApiGeneratorOptions,
	"schemaType" | "operationFilters"
> {
	/**
	 * Input OpenAPI specification file path (YAML or JSON)
	 */
	input: string;

	/**
	 * Output file path for client class
	 *
	 * Generates a Playwright API passthrough client in a separate file:
	 * - Client provides thin wrapper around Playwright's APIRequestContext
	 * - No schema imports needed (pure passthrough)
	 */
	outputClient: string;

	/**
	 * Optional: Output file path for service class
	 *
	 * When specified:
	 * - Generates a type-safe validation service in a separate file
	 * - Service uses client for API calls and validates responses with Zod
	 * - Imports schemas from main output and client class from outputClient
	 *
	 * When omitted:
	 * - No service layer is generated
	 */
	outputService?: string;

	/**
	 * Operation filtering options (Playwright-specific with status code support)
	 * Allows filtering operations by tags, paths, methods, operationIds, deprecated status, and status codes
	 */
	operationFilters?: PlaywrightOperationFilters;

	/**
	 * Whether to validate request body data with Zod schemas in service methods
	 * @default false
	 */
	validateServiceRequest?: boolean;

	/**
	 * Header parameters to ignore during schema and service generation
	 * Supports glob patterns for flexible matching (e.g., "X-*", "Authorization")
	 * Use ["*"] to ignore all headers
	 *
	 * Matching is case-insensitive (follows HTTP header semantics)
	 * Empty array or undefined = include all headers
	 *
	 * When headers are ignored:
	 * - No Zod schemas generated for those headers
	 * - No TypeScript types created
	 * - Service methods won't include them in parameters
	 * - Client methods remain unaffected (passthrough)
	 *
	 * @example ["Authorization"] - Ignore Authorization header
	 * @example ["X-*"] - Ignore all headers starting with X-
	 * @example ["*"] - Ignore all headers
	 * @default undefined (include all headers)
	 */
	ignoreHeaders?: string[];

	/**
	 * Base path to prepend to all API endpoints
	 * Useful for API versioning or common path prefixes
	 * Note: This applies to all operations in the spec. For different base paths,
	 * use separate config specs (one per API version).
	 * @example "/api/v1" -> GET /api/v1/users
	 * @default undefined (no base path)
	 */
	basePath?: string;

	/**
	 * Strip a common prefix from all paths before processing
	 * Useful when OpenAPI spec has redundant path prefixes that you want to ignore
	 *
	 * Supports both literal strings and glob patterns:
	 * - Literal string: "/api/v1" (must match exactly)
	 * - Glob pattern: "/api/v*" (uses minimatch for pattern matching)
	 *
	 * Glob pattern syntax:
	 * - * matches any characters within a single path segment (stops at /)
	 * - ** matches any characters across multiple path segments (crosses / boundaries)
	 * - ? matches a single character
	 * - [abc] matches any character in the set
	 * - {a,b} matches any of the alternatives
	 * - !(pattern) matches anything except the pattern
	 *
	 * This affects:
	 * - Method name generation (shorter, cleaner names)
	 * - JSDoc comments (shows stripped paths)
	 * - Operation filtering (filters apply to stripped paths)
	 *
	 * The basePath option can add back a prefix for actual HTTP calls.
	 *
	 * @example
	 * // Spec has: /api/v1.0/users, /api/v1.0/posts
	 * // stripPathPrefix: "/api/v1.0"
	 * // Results in: /users, /posts
	 * // Method names: getUsers(), getPosts()
	 * // Then use basePath: "/api/v1.0" to add it back for HTTP calls
	 *
	 * @example
	 * // Strip any versioned prefix using glob pattern
	 * // stripPathPrefix: "/api/v*"
	 * // Matches: /api/v1/, /api/v2/, /api/v10/, etc.
	 *
	 * @example
	 * // Strip versioned prefix with dots
	 * // stripPathPrefix: "/api/v[0-9].*"
	 * // Matches: /api/v1.0/, /api/v2.5/, etc.
	 *
	 * @default undefined (no stripping)
	 */
	stripPathPrefix?: string;

	/**
	 * Whether to use operationId from OpenAPI spec for method names
	 * When true: Uses operationId if available, falls back to generated names
	 * When false: Always generates method names from HTTP method + path
	 * @example true: "getUserById" (from operationId)
	 * @example false: "getUsersByUserId" (generated from GET /users/{userId})
	 * @default false
	 */
	useOperationId?: boolean;

	/**
	 * Preferred content types for response handling, in order of priority.
	 * When a response has multiple content types, the generator will select
	 * the first matching content type from this list.
	 * Falls back to the first content type in the spec if no match is found.
	 *
	 * @default ["application/json"]
	 * @example ["application/json", "text/json", "application/xml"]
	 */
	preferredContentTypes?: string[];

	/**
	 * Fallback parsing method for unknown or missing content types in service generation
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
	 * Zod error formatting style for validation errors in service methods
	 * - "standard": Uses schema.parseAsync() - throws ZodError directly (default)
	 * - "prettify": Uses z.prettifyError() for human-readable error messages
	 * - "prettifyWithValues": Includes actual received values in error messages for easier debugging
	 *
	 * @default "standard"
	 * @example
	 * // standard: throws ZodError with issues array
	 * // prettify: "✖ Expected string, received number\n  → at blaat[0].foo"
	 * // prettifyWithValues: "✖ Expected string, received number (received: 123)\n  → at blaat[0].foo"
	 */
	zodErrorFormat?: ZodErrorFormat;
}

/**
 * Root configuration file structure for Playwright generator
 */
export interface PlaywrightConfigFile {
	/**
	 * Global default options applied to all specs
	 * Can be overridden by individual spec configurations
	 * Note: File paths (input, outputTypes/output, outputZodSchemas, outputClient, outputService) must be specified per-spec
	 */
	defaults?: Partial<
		Omit<
			OpenApiPlaywrightGeneratorOptions,
			"input" | "outputTypes" | "outputZodSchemas" | "outputClient" | "outputService"
		>
	>;

	/**
	 * Array of OpenAPI specifications to process
	 * Each spec must have input, outputClient, and at least one of:
	 * - `outputTypes` (preferred) - generates types (and schemas when outputZodSchemas not set)
	 * - `output` (deprecated alias for outputTypes)
	 * - `outputZodSchemas` (optional) - when specified, schemas go here with z.ZodType<TypeAlias> syntax
	 */
	specs: (Omit<OpenApiPlaywrightGeneratorOptions, "outputTypes"> & {
		outputTypes?: string;
		/**
		 * @deprecated Use `outputTypes` instead.
		 */
		output?: string;
	})[];

	/**
	 * Execution mode for batch processing
	 * @default "parallel"
	 */
	executionMode?: "parallel" | "sequential";
}

/**
 * Helper function for type-safe config file creation
 * Provides IDE autocomplete and type checking for Playwright config files
 *
 * File Splitting Examples:
 *
 * 1. Schemas + Client (minimum required):
 *    { input: 'api.yaml', outputTypes: 'schemas.ts', outputClient: 'client.ts' }
 *
 * 2. Schemas + Client + Service (full setup):
 *    { input: 'api.yaml', outputTypes: 'schemas.ts', outputClient: 'client.ts', outputService: 'service.ts' }
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@cerios/openapi-to-zod-playwright';
 *
 * export default defineConfig({
 *   defaults: {
 *     mode: 'strict',
 *     includeDescriptions: true
 *   },
 *   specs: [
 *     // Schemas + Client (minimum required)
 *     { input: 'api-v1.yaml', outputTypes: 'tests/schemas.ts', outputClient: 'tests/client.ts' },
 *
 *     // Schemas + Client + Service (full setup)
 *     {
 *       input: 'api-v2.yaml',
 *       outputTypes: 'tests/schemas.ts',
 *       outputClient: 'tests/client.ts',
 *       outputService: 'tests/service.ts'
 *     }
 *   ]
 * });
 * ```
 */
export function defineConfig(config: PlaywrightConfigFile): PlaywrightConfigFile {
	return config;
}
