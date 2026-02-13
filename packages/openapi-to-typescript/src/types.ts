/**
 * @cerios/openapi-to-typescript
 *
 * Types for TypeScript type generation from OpenAPI specifications
 */

import type { BaseGeneratorOptions, OpenAPISpec, OperationFilters, RequireExcept } from "@cerios/openapi-core";

/**
 * Format for generating enums
 * - 'enum': Generate TypeScript enums
 * - 'union': Generate union of string literals (default)
 * - 'const-object': Generate const object with derived type
 */
export type EnumFormat = "enum" | "union" | "const-object";

/**
 * Options for TypeScriptGenerator
 *
 * Extends BaseGeneratorOptions from @cerios/openapi-core with TypeScript-specific options
 */
export interface TypeScriptGeneratorOptions extends BaseGeneratorOptions {
	/**
	 * Format for generating enums
	 * @default 'const-object'
	 */
	enumFormat?: EnumFormat;
}

/**
 * Resolved options with defaults applied
 */
export interface ResolvedOptions
	extends RequireExcept<
		TypeScriptGeneratorOptions,
		"stripSchemaPrefix" | "stripPathPrefix" | "operationFilters" | "prefix" | "suffix" | "batchSize"
	> {}

/**
 * Execution mode for batch processing
 */
export type ExecutionMode = "parallel" | "sequential";

/**
 * Default options that can be shared across specs
 */
export interface DefaultOptions {
	enumFormat?: EnumFormat;
	includeDescriptions?: boolean;
	defaultNullable?: boolean;
	prefix?: string;
	suffix?: string;
	stripSchemaPrefix?: string | string[];
	stripPathPrefix?: string;
	useOperationId?: boolean;
	operationFilters?: OperationFilters;
	showStats?: boolean;
	batchSize?: number;
}

/**
 * Spec options that can also include a name
 */
export interface SpecOptions extends TypeScriptGeneratorOptions {
	/**
	 * Optional name for this spec (for logging)
	 */
	name?: string;
}

/**
 * Configuration file schema
 */
export interface ConfigFile {
	/**
	 * Default options applied to all specs
	 */
	defaults?: DefaultOptions;

	/**
	 * Array of specifications to process
	 */
	specs: SpecOptions[];

	/**
	 * Execution mode for batch processing
	 * @default 'parallel'
	 */
	executionMode?: ExecutionMode;
}

/**
 * Define a configuration file with type checking
 */
export function defineConfig(config: ConfigFile): ConfigFile {
	return config;
}

/**
 * Re-export OpenAPISpec for convenience
 */
export type { OpenAPISpec };
