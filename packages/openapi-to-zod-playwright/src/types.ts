import type { OpenApiGeneratorOptions } from "@cerios/openapi-to-zod";

/**
 * Generator options for Playwright client generation
 *
 * File Splitting Architecture:
 * - Schemas (main output): Always generated, contains Zod schemas and TypeScript types
 * - Client (outputClient): Optional, Playwright API passthrough wrapper
 * - Service (outputService): Optional, type-safe validation layer (requires outputClient)
 */
export interface OpenApiPlaywrightOpenApiGeneratorOptions extends Omit<OpenApiGeneratorOptions, "schemaType"> {
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
	 * Whether to validate request body data with Zod schemas in service methods
	 * @default false
	 */
	validateServiceRequest?: boolean;

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
	 * Schema type is always "all" for Playwright generator
	 * Both request and response schemas are required
	 * @internal
	 */
	schemaType?: "all";
}

/**
 * Root configuration file structure for Playwright generator
 */
export interface PlaywrightConfigFile {
	/**
	 * Global default options applied to all specs
	 * Can be overridden by individual spec configurations
	 */
	defaults?: Partial<Omit<OpenApiPlaywrightOpenApiGeneratorOptions, "input" | "output">>;

	/**
	 * Array of OpenAPI specifications to process
	 * Each spec must have input and output paths
	 */
	specs: OpenApiPlaywrightOpenApiGeneratorOptions[];

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
