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
	 * Output file path for generated code
	 */
	output: string;

	/**
	 * Schema type is always "all" for Playwright generator
	 * Both request and response schemas are required
	 * @internal
	 */
	schemaType?: "all";
}

/**
 * Configuration for a single OpenAPI spec for Playwright generation
 */
export interface PlaywrightSpecConfig extends PlaywrightGeneratorOptions {
	/**
	 * Optional name/identifier for this spec (for logging purposes)
	 */
	name?: string;
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
	specs: PlaywrightSpecConfig[];

	/**
	 * Execution mode for batch processing
	 * @default "parallel"
	 */
	executionMode?: "parallel" | "sequential";
}

/**
 * Helper function to define a config file with type safety
 */
export function defineConfig(config: PlaywrightConfigFile): PlaywrightConfigFile {
	return config;
}
