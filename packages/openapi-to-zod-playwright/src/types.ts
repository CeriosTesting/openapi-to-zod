import type { OpenApiGeneratorOptions, OperationFilters } from "@cerios/openapi-to-zod";

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
 * - Schemas (main output): Always generated, contains Zod schemas and TypeScript types
 * - Client (outputClient): Optional, Playwright API passthrough wrapper
 * - Service (outputService): Optional, type-safe validation layer (requires outputClient)
 */
export interface OpenApiPlaywrightGeneratorOptions
	extends Omit<OpenApiGeneratorOptions, "schemaType" | "operationFilters"> {
	/**
	 * Input OpenAPI specification file path (YAML or JSON)
	 */
	input: string;

	/**
	 * Output file path for schemas and types (always generated)
	 * Contains Zod validation schemas and TypeScript type definitions
	 * Required when calling generate() to write to a file
	 * Optional when using generateString() for testing
	 */
	output?: string;

	/**
	 * Optional: Output file path for client class
	 *
	 * When specified:
	 * - Generates a Playwright API passthrough client in a separate file
	 * - Client provides thin wrapper around Playwright's APIRequestContext
	 * - No schema imports needed (pure passthrough)
	 *
	 * When omitted:
	 * - Only schemas and types are generated
	 * - Use this when you only need validation schemas
	 */
	outputClient?: string;

	/**
	 * Optional: Output file path for service class
	 *
	 * When specified:
	 * - Generates a type-safe validation service in a separate file
	 * - Service uses client for API calls and validates responses with Zod
	 * - REQUIRES outputClient to be specified (service depends on client)
	 * - Imports schemas from main output and client class from outputClient
	 *
	 * When omitted:
	 * - No service layer is generated
	 *
	 * Note: You cannot generate service without client
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
	 * Supports both literal strings and regex patterns:
	 * - Literal string: "/api/v1" (must match exactly)
	 * - Regex pattern: "^/api/v\\d+" (auto-detected or use RegExp for TypeScript configs)
	 *
	 * Regex auto-detection checks for: ^, $, \\d, \\w, \\s, .*, .+, [], ()
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
	 * // Strip any versioned prefix
	 * // stripPathPrefix: "^/api/v\\d+\\.\\d+"
	 * // Matches: /api/v1.0/, /api/v2.5/, etc.
	 *
	 * @default undefined (no stripping)
	 */
	stripPathPrefix?: string | RegExp;

	/**
	 * Whether to use operationId from OpenAPI spec for method names
	 * When true: Uses operationId if available, falls back to generated names
	 * When false: Always generates method names from HTTP method + path
	 * @example true: "getUserById" (from operationId)
	 * @example false: "getUsersByUserId" (generated from GET /users/{userId})
	 * @default true
	 */
	useOperationId?: boolean;
}

/**
 * Root configuration file structure for Playwright generator
 */
export interface PlaywrightConfigFile {
	/**
	 * Global default options applied to all specs
	 * Can be overridden by individual spec configurations
	 * Note: File paths (input, output, outputClient, outputService) must be specified per-spec
	 */
	defaults?: Partial<Omit<OpenApiPlaywrightGeneratorOptions, "input" | "output" | "outputClient" | "outputService">>;

	/**
	 * Array of OpenAPI specifications to process
	 * Each spec must have input and output paths
	 */
	specs: OpenApiPlaywrightGeneratorOptions[];

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
 * 1. Schemas only (no client, no service):
 *    { input: 'api.yaml', output: 'schemas.ts' }
 *
 * 2. Schemas + Client (separate files):
 *    { input: 'api.yaml', output: 'schemas.ts', outputClient: 'client.ts' }
 *
 * 3. Schemas + Client + Service (all separate):
 *    { input: 'api.yaml', output: 'schemas.ts', outputClient: 'client.ts', outputService: 'service.ts' }
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
 *     // Schemas only
 *     { input: 'api-v1.yaml', output: 'tests/schemas.ts' },
 *
 *     // Schemas + Client + Service (full setup)
 *     {
 *       input: 'api-v2.yaml',
       output: 'tests/schemas.ts',
       outputClient: 'tests/client.ts',
       outputService: 'tests/service.ts'
 *     }
 *   ]
 * });
 * ```
 */
export function defineConfig(config: PlaywrightConfigFile): PlaywrightConfigFile {
	return config;
}
