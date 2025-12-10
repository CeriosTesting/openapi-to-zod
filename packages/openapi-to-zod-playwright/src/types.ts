import type { GeneratorOptions } from "@cerios/openapi-to-zod";

/**
 * Branded type for file paths to ensure type safety at compile time
 * Prevents mixing plain strings with validated file paths
 */
export type FilePath = string & { readonly __brand: "FilePath" };

/**
 * Namespace for FilePath utility functions
 */
export namespace FilePath {
	/**
	 * Create a FilePath from a string (no runtime validation, compile-time branding only)
	 */
	export function from(path: string): FilePath {
		return path as FilePath;
	}

	/**
	 * Type guard to check if a value is a FilePath
	 */
	export function is(value: unknown): value is FilePath {
		return typeof value === "string";
	}
}

/**
 * Branded type for schema names to ensure type safety at compile time
 */
export type SchemaName = string & { readonly __brand: "SchemaName" };

/**
 * Namespace for SchemaName utility functions
 */
export namespace SchemaName {
	/**
	 * Create a SchemaName from a string (no runtime validation, compile-time branding only)
	 */
	export function from(name: string): SchemaName {
		return name as SchemaName;
	}

	/**
	 * Type guard to check if a value is a SchemaName
	 */
	export function is(value: unknown): value is SchemaName {
		return typeof value === "string";
	}
}

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
