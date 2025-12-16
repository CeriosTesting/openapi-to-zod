/**
 * Internal utilities shared between @cerios packages
 *
 * ⚠️ WARNING: NOT FOR PUBLIC USE
 *
 * This module exposes internal implementation details that are shared
 * between @cerios/openapi-to-zod and @cerios/openapi-to-zod-playwright.
 *
 * These APIs are NOT considered part of the public API surface and may
 * change without notice in minor or patch versions. Use at your own risk.
 *
 * @internal
 * @packageDocumentation
 */

// Batch execution utilities
export { executeBatch, type Generator, getBatchExitCode } from "./batch-executor";

// Configuration schemas and validation
export type { BaseOperationFilters, RequestResponseOptions } from "./utils/config-schemas";
export { OperationFiltersSchema, RequestResponseOptionsSchema } from "./utils/config-schemas";
export { formatConfigValidationError } from "./utils/config-validation";

// Caching utilities
export { LRUCache } from "./utils/lru-cache";

// String and naming utilities
export { toCamelCase, toPascalCase } from "./utils/name-utils";
// Operation filtering utilities
export {
	createFilterStatistics,
	type FilterStatistics,
	formatFilterStatistics,
	shouldIncludeOperation,
	validateFilters,
} from "./utils/operation-filters";
export { escapeJSDoc } from "./utils/string-utils";

// TypeScript loading utilities
export { createTypeScriptLoader } from "./utils/typescript-loader";
