# @cerios/openapi-to-zod

## 0.5.0

### Minor Changes

- Introduces fine-grained control over which API operations get generated through configurable filters based on tags, paths, methods, operationIds, and deprecated status. Supports glob patterns for flexible matching with include/exclude logic where excludes override includes.

  Adds typed header parameter schema generation for operations, creating compile-time type safety without runtime validation. Headers follow HTTP semantics as optional strings.

  Enhances useOperationId option to control method naming strategy, allowing either operationId-based or auto-generated names from HTTP method and path.

## 0.4.0

### Minor Changes

- Core Generator & Types Refactor:

  - Renamed PlaywrightGenerator to OpenApiPlaywrightGenerator throughout the codebase, updated all imports/exports, and changed related type names to be more descriptive and consistent (OpenApiPlaywrightGeneratorOptions).
  - Updated the import from ZodSchemaGenerator to OpenApiGenerator in the generator implementation.

  CLI Usability Improvements:

  - Added automatic discovery of OpenAPI spec files in spec/ and specs/ folders, with user-friendly selection and pagination for large numbers of files. Falls back to manual entry if no files are found.

  Error Handling Consistency:

  - Unified all custom error classes to extend from OpenApiPlaywrightGeneratorError instead of PlaywrightGeneratorError, and updated all error class names accordingly for consistency.

  Generated Code Documentation Enhancements:

  - Added summary, description, and deprecated fields to endpoint metadata in both client and service generators, and used a new generateOperationJSDoc utility to produce richer, more informative JSDoc comments for generated methods.

## 0.3.0

### Minor Changes

- - Simplifies generator logic by removing CLI option merging and focusing solely on config-based generation with better error messages when config files are missing.
  - Adds interactive --init command to guide users through creating config files with prompts for input/output paths, format selection (TypeScript/JSON), and optional commonly-used defaults.

## 0.2.0

### Minor Changes

- Adds query parameter schema generation and fixes test configuration

  - Generates typed query parameter schemas from OpenAPI path operations, improving type safety for API client methods. Query parameters with arrays are automatically serialized as comma-separated strings to match Playwright's expected format.

  - Derives client and service class names from output file paths to support multiple API clients in the same project, avoiding hardcoded "ApiClient" and "ApiService" names.

  - Fixes TypeScript enum generation to use z.nativeEnum() instead of z.enum() for proper validation. Improves schema dependency sorting to handle circular dependencies by placing them after their non-circular dependencies.

## 0.1.2

### Patch Changes

- Prevents file write errors when output directories don't exist by creating them recursively before writing generated files.

## 0.1.1

### Patch Changes

- es-build fix

## 0.1.0

### Minor Changes

- Initial version
