/**
 * @cerios/openapi-to-k6
 *
 * Types for K6 HTTP client generation from OpenAPI specifications
 */

import type { OperationFilters } from "@cerios/openapi-core";
import type { TypeScriptGeneratorOptions } from "@cerios/openapi-to-typescript";

// Re-export OperationFilters from core for convenience
export type { OperationFilters } from "@cerios/openapi-core";

// Re-export types from openapi-to-typescript
export type { EnumFormat } from "@cerios/openapi-to-typescript";

// Re-export K6 Response type for use in K6ServiceResult
export type { Response as K6Response } from "k6/http";

/**
 * K6 service result type - combines HTTP response with parsed data and status check result
 * Used as return type for service methods
 *
 * @template T - The type of the parsed response data (from generated types)
 *
 * @example
 * ```typescript
 * // Service method returns K6ServiceResult<User>
 * const result = service.getUserById("123");
 * if (result.ok) {
 *   console.log(result.data.name); // data is typed as User
 * } else {
 *   console.log(`Request failed with status: ${result.response.status}`);
 * }
 * ```
 */
export interface K6ServiceResult<T> {
	/** The raw K6 HTTP response */
	response: import("k6/http").Response;
	/** The parsed response data */
	data: T;
	/** Whether the status code check passed */
	ok: boolean;
}

/**
 * Generator options for K6 client generation
 */
export interface OpenApiK6GeneratorOptions extends Omit<TypeScriptGeneratorOptions, "operationFilters"> {
	/**
	 * Input OpenAPI specification file path (YAML or JSON)
	 */
	input: string;

	/**
	 * Output client file path for generated K6 client (passthrough layer)
	 */
	outputClient: string;

	/**
	 * Output service file path for generated K6 service (validation layer)
	 * When specified, generates a service class that:
	 * - Wraps the client methods
	 * - Validates status codes using K6's check() function
	 * - Parses response bodies
	 * - Returns K6ServiceResult<T> with response, data, and ok flag
	 */
	outputService?: string;

	/**
	 * Operation filtering options
	 */
	operationFilters?: OperationFilters;

	/**
	 * Whether to use operationId from OpenAPI spec for generated naming
	 * When true: Uses operationId if available, falls back to generated names
	 * When false: Always generates names from HTTP method + path
	 *
	 * Affects:
	 * - Client and service method names
	 * - Operation-derived TypeScript type names (query/header/request/response)
	 * @example true: "getUserById" (from operationId)
	 * @example false: "getUsersByUserId" (generated from GET /users/{userId})
	 * @default false
	 */
	useOperationId?: boolean;

	/**
	 * Base path to prepend to all API endpoints
	 * Useful for API versioning or common path prefixes
	 * @example "/api/v1" -> GET /api/v1/users
	 * @default undefined (no base path)
	 */
	basePath?: string;

	/**
	 * Strip a common prefix from all paths before processing
	 * Useful when OpenAPI spec has redundant path prefixes
	 *
	 * Supports both literal strings and glob patterns:
	 * - Literal string: "/api/v1" (must match exactly)
	 * - Glob pattern: "/api/v*" (uses minimatch for pattern matching)
	 *
	 * @example "/api/v1" -> strips "/api/v1" from all paths
	 * @default undefined (no stripping)
	 */
	stripPathPrefix?: string;

	/**
	 * Header parameters to ignore during generation
	 * Supports glob patterns for flexible matching (e.g., "X-*", "Authorization")
	 * Use ["*"] to ignore all headers
	 *
	 * Matching is case-insensitive (follows HTTP header semantics)
	 *
	 * @example ["Authorization"] - Ignore Authorization header
	 * @example ["X-*"] - Ignore all headers starting with X-
	 * @default undefined (include all headers)
	 */
	ignoreHeaders?: string[];

	/**
	 * Whether to include JSDoc comments with descriptions
	 * @default true
	 */
	includeDescriptions?: boolean;

	/**
	 * Whether to show generation statistics
	 * @default true
	 */
	showStats?: boolean;

	/**
	 * Preferred content types for request/response handling, in order of priority
	 * First match wins
	 * @default ["application/json"]
	 */
	preferredContentTypes?: string[];
}

/**
 * Root configuration file structure for K6 generator
 */
export interface K6ConfigFile {
	/**
	 * Global default options applied to all specs
	 * Can be overridden by individual spec configurations
	 * Note: File paths (input, outputClient, outputTypes, outputService) must be specified per-spec
	 */
	defaults?: Partial<Omit<OpenApiK6GeneratorOptions, "input" | "outputClient" | "outputTypes" | "outputService">>;

	/**
	 * Array of OpenAPI specifications to process
	 * Each spec must have input and output paths
	 */
	specs: OpenApiK6GeneratorOptions[];

	/**
	 * Execution mode for batch processing
	 * @default "parallel"
	 */
	executionMode?: "parallel" | "sequential";
}

/**
 * Helper function for type-safe config file creation
 * Provides IDE autocomplete and type checking for K6 config files
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@cerios/openapi-to-k6';
 *
 * export default defineConfig({
 *   defaults: {
 *     includeDescriptions: true,
 *     preferredContentTypes: ['application/json']
 *   },
 *   specs: [
 *     {
 *       input: 'openapi.yaml',
 *       outputClient: 'k6/api-client.ts',
 *       outputTypes: 'k6/api-types.ts'
 *     }
 *   ]
 * });
 * ```
 */
export function defineConfig(config: K6ConfigFile): K6ConfigFile {
	return config;
}
