// Check for core dependency before any imports from it
import { checkCoreDependency } from "./utils/dependency-check";

checkCoreDependency();

// Errors - re-exported from core for public API convenience
export {
	CircularReferenceError,
	CliOptionsError,
	ConfigValidationError,
	FileOperationError,
	MissingDependencyError,
	SpecValidationError,
} from "@cerios/openapi-core";
// Re-export commonly used types from @cerios/openapi-to-zod for convenience
export type {
	CommonSchemaOptions,
	ExecutionMode,
	OpenAPISchema,
	OpenAPISpec,
	OpenApiGeneratorOptions,
	OperationFilters,
	RequestOptions,
	ResponseOptions,
} from "@cerios/openapi-to-zod";
export { ClientGenerationError } from "./errors";
export { OpenApiPlaywrightGenerator } from "./openapi-playwright-generator";
// Runtime exports for generated code
export type {
	ApiRequestContextOptions,
	HttpHeaders,
	MultipartFormData,
	MultipartFormValue,
	QueryParams,
	RequestBody,
	UrlEncodedFormData,
} from "./runtime";
export { serializeParams } from "./runtime";
export {
	formatZodErrorPath,
	formatZodErrorWithValues,
	parseWithPrettifyError,
	parseWithPrettifyErrorWithValues,
} from "./runtime/zod-helpers";
export type { OpenApiPlaywrightGeneratorOptions, PlaywrightConfigFile, PlaywrightOperationFilters } from "./types";
export { defineConfig } from "./types";
