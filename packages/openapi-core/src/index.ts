/**
 * @cerios/openapi-core
 *
 * Core utilities for parsing and processing OpenAPI specifications.
 * Shared foundation for OpenAPI code generators.
 */

export type { BatchExecutionSummary, Generator, SpecResult } from "./batch-executor";
// Batch Execution
export { executeBatch, getBatchExitCode } from "./batch-executor";
// Errors
export {
	CircularReferenceError,
	CliOptionsError,
	ConfigurationError,
	ConfigValidationError,
	FileOperationError,
	GeneratorError,
	MissingDependencyError,
	SchemaGenerationError,
	SpecValidationError,
	TemplateError,
} from "./errors";
// Types
export type {
	BaseGeneratorOptions,
	ExecutionMode,
	HttpMethod,
	OpenAPIParameter,
	OpenAPIRequestBody,
	OpenAPIResponse,
	OpenAPISchema,
	OpenAPISpec,
	OperationFilters,
	RequireExcept,
} from "./types";
export { HTTP_METHODS } from "./types";
// CLI Utilities
export type { FindSpecFilesOptions, FindSpecFilesResult, SpecFile } from "./utils/cli-utils";
export { findSpecFiles, getRandomCeriosMessage } from "./utils/cli-utils";
// Config Loader Factory
export type { ConfigLoader, ConfigLoaderOptions } from "./utils/config-loader-factory";
export { createConfigLoader, mergeCliWithConfig } from "./utils/config-loader-factory";
// Config Schemas - for extending in other packages
export type {
	BaseDefaultsInput,
	BaseGeneratorOptionsInput,
	BaseOperationFilters,
	RequestResponseOptions,
} from "./utils/config-schemas";
export {
	BaseDefaultsSchema,
	BaseGeneratorOptionsSchema,
	ExecutionModeSchema,
	OperationFiltersSchema,
	RegexPatternSchema,
	RequestResponseOptionsSchema,
} from "./utils/config-schemas";
// Config Validation
export {
	type CustomFieldMessages,
	type FormatZodErrorsOptions,
	formatConfigValidationError,
} from "./utils/config-validation";
export type { ContentTypeParseResult, FallbackContentTypeParsing } from "./utils/content-type-utils";
// Content Type Utilities
export {
	DEFAULT_PREFERRED_CONTENT_TYPES,
	getResponseParseMethod,
	normalizeContentType,
	selectContentType,
} from "./utils/content-type-utils";
// Enum Utilities
export { numericToEnumMember, stringToEnumMember } from "./utils/enum-utils";
// Header Filters
export { filterHeaders, shouldIgnoreHeader, validateIgnorePatterns } from "./utils/header-filters";
// LRU Cache
export { LRUCache } from "./utils/lru-cache";
// Method Naming
export {
	extractPathParams,
	generateHttpMethodName,
	pathToPascalCase,
	sanitizeOperationId,
	sanitizeParamName,
} from "./utils/method-naming";
export type { NamingOptions } from "./utils/name-utils";
// Name Utilities
export {
	applyFormatting,
	capitalize,
	deriveClassName,
	generateHeaderParamsTypeName,
	generateInlineRequestTypeName,
	generateInlineResponseTypeName,
	generateMethodNameFromPath,
	generateQueryParamsTypeName,
	getOperationName,
	normalizeSchemaTypeName,
	resolveRefName,
	toCamelCase,
	toPascalCase,
} from "./utils/name-utils";
export type { FilterStatistics } from "./utils/operation-filters";
// Operation Filters
export {
	createFilterStatistics,
	formatFilterStatistics,
	shouldIncludeOperation,
	validateFilters,
} from "./utils/operation-filters";
// Path Utilities
export { constructFullPath, normalizeBasePath } from "./utils/path-utils";
// Pattern Utilities
export { isGlobPattern, stripAffixes, stripPathPrefix, stripPrefix, stripSuffix } from "./utils/pattern-utils";
// Ref Resolution
export { mergeParameters, resolveRequestBodyRef, resolveResponseRef } from "./utils/ref-resolver";
// Schema Traversal
export type { SchemaContext, SchemaUsageAnalysis } from "./utils/schema-traversal";
export {
	analyzeSchemaUsage,
	classifyEnumType,
	detectCircularReferences,
	expandTransitiveReferences,
	extractSchemaRefs,
	topologicalSortSchemas,
} from "./utils/schema-traversal";
// Spec Parser
export type { ParseOpenAPISpecOptions } from "./utils/spec-parser";
export { loadOpenAPISpec, loadOpenAPISpecCached } from "./utils/spec-parser";
// String Utilities
export {
	escapeDescription,
	escapeJSDoc,
	escapePattern,
	getPrimaryType,
	hasMultipleTypes,
	isNullable,
} from "./utils/string-utils";
// Type Guards
export type { OpenAPIOperationLike, PathItemLike } from "./utils/type-guards";
export { getOperation, isOpenAPIOperation, isPathItemLike } from "./utils/type-guards";
// TypeScript Loader
export { createTypeScriptLoader } from "./utils/typescript-loader";
// Endpoint Extraction
export type {
	EndpointInfo,
	EndpointStats,
	ExtractEndpointsOptions,
	ParameterInfo,
	RequestBodyInfo,
} from "./utils/endpoint-extraction";
export { extractEndpoints, getEndpointStats } from "./utils/endpoint-extraction";
// Schema Utilities
export type { MediaTypeContent, OpenAPISchemaLike, ResolvedRequestBody, ResolvedResponse } from "./utils/schema-utils";
export {
	isMediaTypeContent,
	isOpenAPIParameter,
	isResolvedRequestBody,
	isResolvedResponse,
	schemaToTypeString,
} from "./utils/schema-utils";
// JSDoc Utilities
export type { GenerateMinimalJSDocOptions, GenerateOperationJSDocOptions } from "./utils/jsdoc-utils";
export { generateMinimalJSDoc, generateOperationJSDoc } from "./utils/jsdoc-utils";
