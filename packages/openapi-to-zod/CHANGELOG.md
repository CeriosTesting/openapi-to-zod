# @cerios/openapi-to-zod

## 1.4.0

### Minor Changes

- efc1693: Generates named schemas for inline request/response types

  Replaces inline Zod schema generation (e.g., `z.string()`, `z.array()`) with named schema types for better type safety and consistency. Inline schemas now receive generated names like `GetUsersResponse` or `PostUsersRequest` and are validated using corresponding Zod schemas from the schemas file.

  Improves error formatting by omitting received values for object/array types in validation errors to reduce noise. Fixes regex pattern escaping to prevent double-escaping of forward slashes already escaped in JSON specifications.

  Refactors date-time format validation and pattern caching to be instance-level rather than global, enabling parallel-safe generator execution without shared mutable state.

## 1.3.2

### Patch Changes

- 07b5fe3: Prevents defaultNullable from applying to compositions

  Fixes incorrect nullable behavior where defaultNullable was being applied to schema composition results (allOf, oneOf, anyOf) when it should only apply to actual property values.

  Composition schemas define shapes and types, not property nullability. The defaultNullable option should only affect properties inside object shapes, which is already handled correctly by the inline object shape generator.

## 1.3.1

### Patch Changes

- 36c6f96: Inline schema code generation now applies the configured prefix and suffix options to schema variable names, ensuring consistent naming between referenced and inline schemas.

  Fix for emptyObjectBehavior. Now working correctly

  defaultnullable fix for $ref

## 1.3.0

### Minor Changes

- 7b502aa: Changes default for useOperationId to false

  Changes the default behavior for method name generation from operationId-based to path-based naming, providing more predictable and consistent method names by default.

  Adds support for $ref resolution in OpenAPI parameters, request bodies, and responses, enabling proper handling of reusable component definitions throughout the spec.

  Implements path-level parameter merging so that parameters defined at the path level are correctly inherited by all operations on that path, following OpenAPI specification.

  Improves Zod v4 compatibility by using dedicated format validators (email, url, uuid) as top-level validators instead of string refinements.

  Restricts defaultNullable to apply only to primitive property values within objects, excluding schema references, enums, const/literal values, and top-level definitions. This prevents unintended nullable annotations on discrete value types and schema references where nullability should be explicit.

  Migrates allOf composition from deprecated .merge() to Zod v4 compliant .extend() method for object schemas while maintaining .and() for primitives.

  Adds emptyObjectBehavior option to control how objects without properties are generated, supporting strict, loose, and record modes for better schema flexibility.

  Enhances union validation with improved edge case handling including single-item simplification, empty array detection with warnings, and discriminator validation that falls back to standard unions when discriminator properties aren't required across all schemas.

  Introduces property conflict detection in allOf compositions to warn developers of potential schema inconsistencies.

## 1.2.0

### Minor Changes

- efd089e: Options to set default nullable for properties. QueryParams for GET operations will now succesfully be generated when no operationId is supplied, will successfully fallback to path naming, Add stripPathPrefix option to OpenApiGenerator for improved query/header parameter naming

  Makes the client property private by prefixing with underscore, following TypeScript conventions for private members that shouldn't be accessed externally.

  Updates JSDoc @returns tags to show actual type names instead of HTTP status descriptions, providing more useful documentation for developers consuming the generated service methods.

  Removes unnecessary explicit return statements from void methods, as TypeScript functions without a return value don't require them.

  Ensures the required @cerios/openapi-to-zod peer dependency is installed before the package attempts to use it. Introduces an early runtime check that validates dependency availability and throws a descriptive error if missing.

## 1.1.1

### Patch Changes

- d32ec53: Fixed the filtering in the schemas and types in openapi-to-zod based on operationFilters in openapi-to-zod-playwright package.

  Glob Pattern Support for Path Prefixes: The stripPathPrefix option in openapi-to-zod-playwright now exclusively supports glob patterns (using minimatch), replacing previous regex-based or RegExp support. This affects the generator’s TypeScript types, implementation, and documentation.

## 1.1.0

### Minor Changes

- 1278b81: Fix for dots in paths and schemas. The ability to strip common path prefixes from OpenAPI paths using the new `stripPathPrefix` option. This results in cleaner generated method names and improved documentation, while maintaining the correct HTTP request paths via the `basePath` option. The implementation includes updates to the code generation logic, configuration schemas, documentation, and peer dependency requirements. Additionally, there are improvements to type handling for schema names in generated TypeScript code.

## 1.0.0

### Major Changes

- First official release. Enjoy!

## 0.6.0

### Minor Changes

- Removes TypeScript native enum generation support, standardizing on Zod enums exclusively for consistency and runtime type safety.

  Eliminates typeMode, enumType, and nativeEnumType options along with their associated complexity. Response schemas always required Zod for validation, making the native type generation only partially useful.

  Updates default configuration recommendations to use strict mode with better defaults. Changes useOperationId default to false, preferring generated path-based method names over potentially inconsistent operationIds.

## 0.5.3

### Patch Changes

- openapi-to-zod is now a peer dependency to openapi-to-zod-playwright

## 0.5.2

### Patch Changes

- re-export types fix

## 0.5.1

### Patch Changes

- fixed Corrects typo in changelog entries where the type was incorrectly referenced as "OpenApiPlaywrightOpenApiGeneratorOptions" instead of the actual "OpenApiPlaywrightGeneratorOptions".

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
