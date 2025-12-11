import type { GeneratorOptions } from "@cerios/openapi-to-zod";

/**
 * Generator options for Playwright client generation
 * Enforces that both request and response schemas are generated
 */
export interface PlaywrightGeneratorOptions extends Omit<GeneratorOptions, "schemaType"> {
	/**
	 * Input OpenAPI specification file path (YAML or JSON)
	 */
	input: string;

	/**
	 * Output file path for generated code (schemas + types always included)
	 * Optional when using string generation methods (generateString, etc.)
	 * Required when calling generate() to write to a file
	 */
	output?: string;

	/**
	 * Optional output file path for client class
	 * If provided, client will be written to this file instead of main output
	 * Requires imports from main output file
	 */
	outputClient?: string;

	/**
	 * Optional output file path for service class
	 * If provided, service will be written to this file instead of main output
	 * Requires imports from main output and client files
	 * Only applicable when generateService is true
	 */
	outputService?: string;

	/**
	 * Whether to generate service class in addition to client
	 * @default true
	 */
	generateService?: boolean;

	/**
	 * Whether to validate request body data with Zod schemas in service methods
	 * Only applicable when generateService is true
	 * @default false
	 */
	validateServiceRequest?: boolean;

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
	defaults?: Partial<Omit<PlaywrightGeneratorOptions, "input" | "output">>;

	/**
	 * Array of OpenAPI specifications to process
	 * Each spec must have input and output paths
	 */
	specs: PlaywrightGeneratorOptions[];

	/**
	 * Execution mode for batch processing
	 * @default "parallel"
	 */
	executionMode?: "parallel" | "sequential";
}

/**
 * Helper function for type-safe config file creation
 * Provides IDE autocomplete and type checking for Playwright config files
 * Note: schemaType is always "all" for Playwright generator (both request/response schemas required)
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@cerios/openapi-to-zod-playwright';
 *
 * export default defineConfig({
 *   defaults: {
 *     mode: 'strict',
 *     includeDescriptions: true,
 *     generateService: true
 *   },
 *   specs: [
 *     { input: 'api-v1.yaml', output: 'tests/api-v1.ts' },
 *     {
 *       input: 'api-v2.yaml',
 *       output: 'tests/api-v2.ts',
 *       outputClient: 'tests/api-v2-client.ts',
 *       outputService: 'tests/api-v2-service.ts'
 *     }
 *   ]
 * });
 * ```
 */
export function defineConfig(config: PlaywrightConfigFile): PlaywrightConfigFile {
	return config;
}
