# @cerios/openapi-to-zod

## 1.5.0

### Minor Changes

- 5fbc8d0: Consolidate duplicate utilities across packages

  ### @cerios/openapi-core (minor)

  - Export `capitalize` function for converting strings to PascalCase (handles kebab-case, snake_case, and dots)
  - Export `applyFormatting` function for applying prefix/suffix formatting to names

  ### @cerios/openapi-to-zod (BREAKING)

  - Removed `utils/typescript-loader.ts` re-export. Import directly from `@cerios/openapi-core`:
    ```ts
    // Before
    import { createTypeScriptLoader } from "@cerios/openapi-to-zod/utils/typescript-loader";
    // After
    import { createTypeScriptLoader } from "@cerios/openapi-core";
    ```
  - Removed `utils/content-type-utils.ts` re-export. Import directly from `@cerios/openapi-core`:
    ```ts
    // Before
    import { getResponseParseMethod } from "@cerios/openapi-to-zod/utils/content-type-utils";
    // After
    import {
      getResponseParseMethod,
      type ContentTypeParseResult,
      type FallbackContentTypeParsing,
    } from "@cerios/openapi-core";
    ```
  - Refactored internal code to use `capitalize` and `generateMethodNameFromPath` from `@cerios/openapi-core`

  ### @cerios/openapi-to-zod-playwright (patch)

  - Use `capitalize` from `@cerios/openapi-core` instead of local duplicate
  - Fixed incorrect JSDoc (function produces PascalCase, not camelCase)
  - Removed dead code (identical if/else branches)

  ### @cerios/openapi-to-typescript (patch)

  - Use `applyFormatting` from `@cerios/openapi-core` instead of local duplicates in `typescript-generator.ts`, `type-generator.ts`, and `enum-generator.ts`

- 5fbc8d0: Add `useOperationId` parity for operation-derived naming across generators.

  ## What changed

  - **Core**: Added shared `useOperationId` option to base generator config/types and extended `getOperationName()` to support explicit operationId toggle behavior.
  - **openapi-to-typescript**:
    - Added `useOperationId` support for operation-derived type names (`QueryParams`, `HeaderParams`, inline request/response types).
    - Default behavior remains unchanged (`useOperationId: true`).
  - **openapi-to-zod**:
    - Added `useOperationId` support for operation-derived query/header schema names.
    - Default behavior remains unchanged (`useOperationId: true`).
  - **openapi-to-k6**:
    - Forwarded `useOperationId` into internal `openapi-to-typescript` schema type generation, so generated operation-derived type names match client/service naming mode.

  ## Notes

  - Existing default naming remains backward compatible.
  - Added/updated tests in TypeScript, Zod, and K6 packages to verify both naming modes.

- 5fbc8d0: Renamed `output` to `outputTypes` as the canonical config field.

  This change improves clarity by explicitly indicating that the output path is for generated types/schemas, distinguishing it from other output options like `outputClient` and `outputService` in the Playwright and K6 packages.

  For `@cerios/openapi-to-zod` and `@cerios/openapi-to-zod-playwright`, backward compatibility is now included:

  - `outputTypes` is the preferred field.
  - Deprecated `output` is still accepted.
  - One of `outputTypes` or `output` is required.
  - If both are set and values differ, configuration validation fails.
  - A deprecation warning is shown in terminal output when `output` is used.

  ### Migration Guide

  Use `outputTypes` going forward:

  **Before:**

  ```json
  {
    "specs": [
      {
        "input": "openapi.yaml",
        "output": "src/schemas.ts"
      }
    ]
  }
  ```

  **After:**

  ```json
  {
    "specs": [
      {
        "input": "openapi.yaml",
        "outputTypes": "src/schemas.ts"
      }
    ]
  }
  ```

  **TypeScript config:**

  ```typescript
  export default defineConfig({
    specs: [
      {
        input: "openapi.yaml",
        outputTypes: "src/schemas.ts", // Previously: output
        outputClient: "src/client.ts",
        outputService: "src/service.ts",
      },
    ],
  });
  ```

  ### Affected Packages

  - `@cerios/openapi-core`: `BaseGeneratorOptions.output` → `BaseGeneratorOptions.outputTypes`
  - `@cerios/openapi-to-zod`: Config files and `OpenApiGeneratorOptions` (`output` remains supported as deprecated alias)
  - `@cerios/openapi-to-zod-playwright`: Config files and `OpenApiPlaywrightGeneratorOptions` (`output` remains supported as deprecated alias)
  - `@cerios/openapi-to-typescript`: Config files and `TypeScriptGeneratorOptions`
  - `@cerios/openapi-to-k6`: Config files and `OpenApiK6GeneratorOptions`

- 5fbc8d0: Add separate types and schemas mode (`outputZodSchemas`) to solve TypeScript depth errors

  ### The Problem

  When using `z.infer<typeof schema>` with very large or deeply nested OpenAPI schemas, TypeScript's type inference can hit recursion limits, causing "Type instantiation is excessively deep and possibly infinite" (TS2589) errors.

  ### The Solution

  New `outputZodSchemas` option generates TypeScript types and Zod schemas in separate files with explicit `z.ZodType<T>` annotations instead of relying on `z.infer`:

  ```typescript
  // Before (can cause TS2589 errors with large schemas):
  export const userSchema = z.object({ ... });
  export type User = z.infer<typeof userSchema>; // 💥 Type instantiation error

  // After (explicit types, no inference needed):
  // types.ts - generated by @cerios/openapi-to-typescript
  export type User = { ... };

  // schemas.ts - generated with z.ZodType<T> annotations
  import type { User } from './types';
  export const userSchema: z.ZodType<User> = z.object({ ... });
  ```

  ### New Options

  - **`outputZodSchemas`**: File path for Zod schemas with explicit type annotations
  - **`enumFormat`**: Choose between `"union"` or `"const-object"` for enum generation (default: `"const-object"`)
  - **`typeAssertionThreshold`**: Complexity threshold for switching from `: z.ZodType<T>` annotation to `as unknown as z.ZodType<T>` double assertion for extremely large schemas

  ### Usage

  ```typescript
  import { defineConfig } from "@cerios/openapi-to-zod";

  export default defineConfig({
    specs: [
      {
        input: "large-api.yaml",
        outputTypes: "src/generated/types.ts", // TypeScript types
        outputZodSchemas: "src/generated/schemas.ts", // Zod schemas
        enumFormat: "const-object", // Optional
        typeAssertionThreshold: 100, // Optional: use double assertion for complex schemas
      },
    ],
  });
  ```

  ### Requirements

  - `@cerios/openapi-to-typescript` must be installed (regular dependency)
  - `outputTypes` is required when `outputZodSchemas` is specified

  ### Benefits

  - Eliminates "Type instantiation is excessively deep" errors
  - Better IDE performance with pre-computed types
  - Cleaner separation of concerns between types and validation
  - Full type safety maintained through explicit `z.ZodType<T>` annotations

### Patch Changes

- 5fbc8d0: Consolidate batch executor, CLI utilities, and config loader across packages

  ### @cerios/openapi-core (minor)

  New exports for shared CLI and batch processing infrastructure:

  - **CLI Utilities** (`cli-utils.ts`):

    - `findSpecFiles(patterns)` - Find OpenAPI spec files matching glob patterns
    - `ceriosMessages` - Array of fun loading messages
    - `getRandomCeriosMessage()` - Get a random loading message

  - **Config Loader Factory** (`config-loader-factory.ts`):

    - `createConfigLoader<TConfig>(options, schema)` - Generic factory for creating type-safe config loaders using cosmiconfig
    - `mergeCliWithConfig<T>(specConfig, cliOptions)` - Merge CLI options with loaded config

  - **Error Classes**:
    - `CliOptionsError` - For CLI argument validation errors
    - `SchemaGenerationError` - For schema generation failures
    - `CircularReferenceError` - For circular reference detection

  ### @cerios/openapi-to-zod (patch)

  - Removed duplicate `batch-executor.ts` - now imports `executeBatch` from `@cerios/openapi-core`
  - CLI utilities (`findSpecFiles`, `ceriosMessages`, `getRandomCeriosMessage`) now imported from `@cerios/openapi-core`
  - Config loader uses `createConfigLoader` factory from `@cerios/openapi-core`
  - Error classes re-exported from `@cerios/openapi-core`

  ### @cerios/openapi-to-typescript (patch)

  - Removed duplicate `batch-executor.ts` - now imports `executeBatch` from `@cerios/openapi-core`
  - CLI utilities imported from `@cerios/openapi-core`
  - Config loader uses `createConfigLoader` factory from `@cerios/openapi-core`
  - Error classes re-exported from `@cerios/openapi-core`

  ### @cerios/openapi-to-zod-playwright (patch)

  - CLI utilities imported from `@cerios/openapi-core`
  - Config loader uses `createConfigLoader` factory from `@cerios/openapi-core`
  - Error classes now use base classes from `@cerios/openapi-core`

- 5fbc8d0: Fix "used before its declaration" TypeScript errors for circular dependencies

  ### @cerios/openapi-to-zod (patch)

  Fixed a bug where schemas involved in mutual circular dependencies (e.g., `Dossier → AbsenceCourse → Dossier` via `allOf` compositions) would cause TypeScript compilation errors due to variables being used before their declaration.

  **Root cause**: The generator was not properly detecting and handling mutual circular references. When schemas reference each other through `allOf`, the topological sort would place them in an order that caused forward references without using `z.lazy()`.

  **Changes**:

  - Added pre-analysis phase to detect circular dependency chains before code generation
  - References to any schema in a circular dependency chain now use `z.lazy()` for deferred evaluation
  - Fixed an issue where new `PropertyGenerator` instances weren't receiving the circular dependencies information
  - Improved topological sort to defer schemas that depend on circular dependencies

  ### @cerios/openapi-to-zod-playwright (patch)

  - Inherits the circular dependency fix from `@cerios/openapi-to-zod`

- 5fbc8d0: ### Bug Fixes

  **@cerios/openapi-to-k6**

  - Fix output files being swapped - client was written to types path and vice versa
  - Fix import path calculation for types file - now correctly computes relative path from client file to types file
  - Fix schema types (response and request body types) not being imported in client file when using separate types file
  - Add `enumFormat` configuration option (inherited from TypeScript generator)
  - K6 config schema now properly extends TypeScript config schema
  - Move runtime utilities (`mergeRequestParameters`, `stringifyHeaders`, `buildQueryString`, `cleanBaseUrl`) to a separate runtime module that is imported by generated clients instead of being generated inline

  **@cerios/openapi-to-typescript**

  - Export `TypeScriptSpecificOptionsSchema`, `TypeScriptGeneratorOptionsSchema`, and `TypeScriptDefaultsSchema` for use by downstream packages

  **All packages**

  - Replace deprecated Zod v4 `.merge()` method with `.extend()` for schema composition

- 5fbc8d0: Add RequireExcept utility type and update stripSchemaPrefix to support arrays

  ### @cerios/openapi-core (minor)

  - Add `RequireExcept<T, K>` utility type for creating "resolved options" types where most properties are required but some remain optional
  - Update `stripPrefix` function to accept `string | string[]` for stripping multiple prefixes

  ### @cerios/openapi-to-typescript (patch)

  - Simplify `ResolvedOptions` interface using the new `RequireExcept` utility type

  ### @cerios/openapi-to-zod (patch)

  - Update `PropertyGeneratorContext.stripSchemaPrefix` type to `string | string[]` for consistency with `BaseGeneratorOptions`

  ### @cerios/openapi-to-zod-playwright (patch)

  - Update `stripSchemaPrefix` parameter types in service generator functions to support `string | string[]`

- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
- Updated dependencies [5fbc8d0]
  - @cerios/openapi-to-typescript@0.1.0
  - @cerios/openapi-core@0.1.0

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
