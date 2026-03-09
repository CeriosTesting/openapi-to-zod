/**
 * @cerios/openapi-to-k6
 *
 * Generate type-safe K6 HTTP clients from OpenAPI specifications
 *
 * @example
 * ```typescript
 * import { OpenApiK6Generator, defineConfig } from '@cerios/openapi-to-k6';
 *
 * // Using the generator directly
 * const generator = new OpenApiK6Generator({
 *   input: './openapi.yaml',
 *   outputClient: './k6/api-client.ts',
 *   outputTypes: './k6/api-types.ts',
 * });
 * generator.generate();
 *
 * // Or generate to string
 * const clientCode = generator.generateString();
 * ```
 */

// Batch execution (from core)
// Errors - re-exported from core for public API convenience
export {
	type BatchExecutionSummary,
	CircularReferenceError,
	CliOptionsError,
	ConfigurationError,
	ConfigValidationError,
	executeBatch,
	FileOperationError,
	type Generator,
	GeneratorError,
	getBatchExitCode,
	MissingDependencyError,
	SchemaGenerationError,
	SpecValidationError,
} from "@cerios/openapi-core";
// Re-export TypeScript generator for types generation
export { TypeScriptGenerator } from "@cerios/openapi-to-typescript";
export { K6ClientGenerationError } from "./errors";

// Main generator
export { OpenApiK6Generator } from "./openapi-k6-generator";
// Types
export type { K6ConfigFile, K6Response, OpenApiK6GeneratorOptions, OperationFilters } from "./types";
export { defineConfig } from "./types";
// Config utilities
export { loadConfig, mergeConfigWithDefaults } from "./utils/config-loader";
