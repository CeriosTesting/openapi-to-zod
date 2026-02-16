# @cerios/openapi-core

Core utilities for parsing and processing OpenAPI specifications. This package provides the shared foundation for OpenAPI code generators.

## Installation

```bash
npm install @cerios/openapi-core
```

## Features

- 🔍 **OpenAPI Parsing** - Parse OpenAPI 3.0/3.1 YAML and JSON specifications
- 🔗 **Reference Resolution** - Resolve `$ref` references throughout the spec
- 🏷️ **Operation Filtering** - Filter operations by tags, paths, and methods
- 🛠️ **Utility Functions** - Common utilities for schema processing
- 📦 **Batch Execution** - Parallel and sequential execution of generators
- 🧪 **Test Fixtures** - Shared OpenAPI fixtures for testing

## Usage

```typescript
import {
	shouldIncludeOperation,
	toPascalCase,
	toCamelCase,
	resolveRefName,
	LRUCache,
	loadOpenAPISpec,
} from "@cerios/openapi-core";

// Load and parse an OpenAPI spec
const spec = await loadOpenAPISpec("openapi.yaml");

// Extract schema name from $ref
const schemaName = resolveRefName("#/components/schemas/User"); // "User"

// Filter operations
const include = shouldIncludeOperation(operation, path, method, {
	includeTags: ["users"],
	excludePaths: ["/internal/*"],
});

// Name utilities
const className = toPascalCase("user-profile"); // "UserProfile"
const methodName = toCamelCase("get-user-by-id"); // "getUserById"
```

## API Reference

### Types

- `OpenAPISpec` - OpenAPI specification structure
- `OpenAPISchema` - Schema definition structure
- `OpenAPIParameter` - Parameter definition
- `OpenAPIRequestBody` - Request body definition
- `OpenAPIResponse` - Response definition
- `OperationFilters` - Operation filtering options
- `ExecutionMode` - Parallel/sequential execution mode
- `BaseGeneratorOptions` - Base options for all generators

### Spec Parsing

- `loadOpenAPISpec()` - Load and parse an OpenAPI spec file
- `loadOpenAPISpecCached()` - Load spec with LRU caching

### Reference Resolution

- `resolveRefName()` - Extract name from `$ref` path
- `resolveRequestBodyRef()` - Resolve request body references
- `resolveResponseRef()` - Resolve response references
- `mergeParameters()` - Merge path and operation parameters

### Operation Filtering

- `shouldIncludeOperation()` - Check if operation matches filters
- `validateFilters()` - Validate filter configuration
- `createFilterStatistics()` - Create filter statistics tracker
- `formatFilterStatistics()` - Format statistics for display

### Name Utilities

- `toPascalCase()` - Convert string to PascalCase
- `toCamelCase()` - Convert string to camelCase
- `resolveRefName()` - Extract name from $ref path
- `getOperationName()` - Get operation name from operationId or path
- `generateMethodNameFromPath()` - Generate method name from path
- `capitalize()` - Capitalize first letter

### Method Naming

- `pathToPascalCase()` - Convert path to PascalCase (e.g., `/users/{userId}` → `UsersByUserId`)
- `generateHttpMethodName()` - Generate method name from HTTP method + path
- `extractPathParams()` - Extract parameter names from path template
- `sanitizeOperationId()` - Sanitize operationId for TypeScript
- `sanitizeParamName()` - Sanitize parameter name for TypeScript

### Schema Traversal

- `extractSchemaRefs()` - Extract all `$ref` names from schema tree
- `expandTransitiveReferences()` - Expand to include transitively referenced schemas
- `detectCircularReferences()` - Detect circular reference chains
- `topologicalSortSchemas()` - Sort schemas by dependencies
- `analyzeSchemaUsage()` - Analyze request/response context usage
- `classifyEnumType()` - Classify enum values as string/number/boolean/mixed

### Header Filters

- `shouldIgnoreHeader()` - Check if header matches ignore patterns
- `filterHeaders()` - Filter headers excluding ignored ones
- `validateIgnorePatterns()` - Validate and warn about unmatched patterns

### Pattern Utilities

- `stripPrefix()` - Strip prefix from schema names
- `stripSuffix()` - Strip suffix from strings
- `stripAffixes()` - Strip both prefix and suffix
- `stripPathPrefix()` - Strip prefix from paths (supports glob)
- `isGlobPattern()` - Check if string is a glob pattern

### String Utilities

- `escapeJSDoc()` - Escape JSDoc content
- `escapeDescription()` - Escape description text
- `escapePattern()` - Escape regex pattern
- `getPrimaryType()` - Get primary type from schema
- `hasMultipleTypes()` - Check if schema has multiple types
- `isNullable()` - Check if schema is nullable

### Content Type Utilities

- `getResponseParseMethod()` - Determine response parsing method (json, text, blob, etc.)

### Config Loader

- `createConfigLoader()` - Factory for type-safe config loaders with cosmiconfig + Zod validation
- `mergeCliWithConfig()` - Merge CLI options with config values (CLI takes precedence)

### CLI Utilities

- `findSpecFiles()` - Find OpenAPI spec files in directory
- `getRandomCeriosMessage()` - Get random CLI greeting message

### Classes

- `LRUCache` - Least Recently Used cache implementation
- `GeneratorError` - Base error class for generators
- `SpecValidationError` - OpenAPI spec validation errors
- `FileOperationError` - File I/O errors
- `ConfigValidationError` - Configuration errors
- `CircularReferenceError` - Circular reference detection errors
- `CliOptionsError` - CLI options validation errors
- `SchemaGenerationError` - Schema generation errors

### Batch Execution

- `executeBatch()` - Execute multiple generators
- `getBatchExitCode()` - Calculate exit code from results
- `Generator` - Interface for generator implementations

## License

MIT
