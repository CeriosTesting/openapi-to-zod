/**
 * Public API for @cerios/openapi-to-zod
 *
 * This module exports the stable, documented API surface.
 * These exports follow semantic versioning.
 *
 * For internal utilities shared between packages, see ./internal.ts
 *
 * @packageDocumentation
 */

// Error classes
export {
	CircularReferenceError,
	CliOptionsError,
	ConfigValidationError,
	FileOperationError,
	GeneratorError,
	SchemaGenerationError,
	SpecValidationError,
} from "./errors";

// Main generator
export { OpenApiGenerator } from "./openapi-generator";

// Types
export type {
	CommonSchemaOptions,
	ConfigFile,
	ExecutionMode,
	OpenAPIParameter,
	OpenAPIRequestBody,
	OpenAPIResponse,
	OpenAPISchema,
	OpenAPISpec,
	OpenApiGeneratorOptions,
	OperationFilters,
	RequestOptions,
	ResponseOptions,
} from "./types";
export { defineConfig } from "./types";
