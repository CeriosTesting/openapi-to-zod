# @cerios/openapi-to-typescript

## 1.0.1

### Patch Changes

- Updated dependencies [2204ab7]
  - @cerios/openapi-core@1.0.1

## 1.0.0

### Minor Changes

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

### Patch Changes

- 5fbc8d0: ### Feature: Add @deprecated JSDoc to TypeScript type properties

  Properties marked with `deprecated: true` in OpenAPI schemas now include a `@deprecated` JSDoc tag in the generated TypeScript types.

  **Behavior:**
  - Deprecated-only property: `/** @deprecated */`
  - Description + deprecated: `/** The description @deprecated */`
  - The `@deprecated` tag is always added regardless of the `includeDescriptions` option

  **Example:**

  OpenAPI spec:

  ```yaml
  properties:
    legacyId:
      type: string
      deprecated: true
    oldName:
      type: string
      description: The old name field
      deprecated: true
  ```

  Generated TypeScript:

  ```typescript
  /** @deprecated */
  legacyId?: string;
  /** The old name field @deprecated */
  oldName?: string;
  ```

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

- 5fbc8d0: ### @cerios/openapi-core

  Added `stringToEnumMember` and `numericToEnumMember` utilities for generating unique TypeScript enum member names:
  - Handles `-` prefix by appending `Desc` suffix (e.g., `-externalKey` → `ExternalkeyDesc`)
  - Handles `+` prefix by appending `Asc` suffix (e.g., `+date` → `DateAsc`)
  - Supports deduplication via optional `Set<string>` parameter to prevent duplicate keys
  - Fallback numeric suffix for remaining collisions (e.g., `foo_bar`, `foo-bar` → `FooBar`, `FooBar2`)

  ### @cerios/openapi-to-typescript

  **Fixed duplicate enum keys** - Sort option enums like `["externalKey", "-externalKey", "name", "-name"]` now correctly generate unique member names:

  ```typescript
  export enum GetEmployeeSortOptions {
  	Externalkey = "externalKey",
  	ExternalkeyDesc = "-externalKey",
  	Name = "name",
  	NameDesc = "-name",
  }
  ```

  **Fixed allOf with type: object** - Schemas that have both `type: object` and `allOf` now correctly generate intersection types instead of empty objects:

  ```yaml
  ParentBillableResource:
    type: object
    allOf:
      - $ref: "#/components/schemas/BaseEntity"
  ```

  Now correctly generates:

  ```typescript
  export type ParentBillableResource = BaseEntity;
  ```

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

- 5fbc8d0: ### Fix: Nullable type consistency in separate schemas mode

  Fixed a TypeScript error that occurred when using separate schemas mode (`outputZodSchemas`) with nullable properties.

  **The Problem:**
  When a property has `nullable: true` in the OpenAPI spec:
  - Zod schema generated: `z.string().nullable()` → infers to `string | null`
  - TypeScript type was generating: `string` or `string | undefined` (missing `| null`)

  This caused TypeScript errors like:

  ```
  Type 'string | null | undefined' is not assignable to type 'string | undefined'.
    Type 'null' is not assignable to type 'string | undefined'.
  ```

  **The Solution:**
  The TypeScript generator now correctly handles `nullable: true` (OpenAPI 3.0) and `type: [string, null]` (OpenAPI 3.1) and generates `| null` in the TypeScript type:

  ```typescript
  // Before (broken)
  export type User = {
  	email?: string; // Missing | null
  };

  // After (fixed)
  export type User = {
  	email?: string | null; // Correctly includes | null
  };
  ```

  **What was fixed:**
  - Nullable handling for `$ref` properties
  - Nullable handling for inline object properties
  - Nullable handling for array types
  - Nullable handling for enum types
  - Nullable handling for primitive type aliases
  - Nullable handling for `allOf`, `oneOf`, `anyOf` compositions
  - OpenAPI 3.1 type arrays with null (e.g., `type: [string, null]`)

  ### Fix: Consistent useOperationId behavior across generators

  Fixed an issue where the `useOperationId` option was being ignored in several places, causing inconsistent naming between service methods, types, and schemas.

  **The Problem:**
  When `useOperationId: false` was set:
  - Service methods correctly used path-based names: `getApiUsers()`
  - But types were generated with operationId-based names: `SearchUsersQueryParams`

  This caused TypeScript errors because the service imported types that didn't exist.

  **Root Cause:**
  Multiple places hardcoded `useOperationId: true`:
  - `generateSchemasString()` forced `useOperationId: true` for schema generator
  - `generateTypesString()` didn't pass `useOperationId` to TypeScriptGenerator
  - `extractEndpoints()` hardcoded `true` in `getOperationName()` calls for QueryParams, HeaderParams, and inline response names

  **The Solution:**
  All generators now consistently use the passed `useOperationId` setting:

  ```typescript
  // With useOperationId: false (path-based naming)
  async getApiUsers(options?: { params?: GetApiUsersQueryParams })

  // With useOperationId: true (operationId-based naming)
  async searchUsers(options?: { params?: SearchUsersQueryParams })
  ```

  **What was fixed:**
  - `generateSchemasString()` no longer overrides `useOperationId`
  - `generateTypesString()` passes `useOperationId` to TypeScriptGenerator
  - `extractEndpoints()` uses the passed `useOperationId` for all type names
  - `hasMultipleStatuses` now only counts 2xx responses (was incorrectly counting 4xx/5xx)

- 5fbc8d0: Fix CLI executable configuration and align package.json with other packages
  - Switch from ESM (`"type": "module"`) to CommonJS (`"type": "commonjs"`) for consistency
  - Fix `bin` field to point to `./dist/cli.js` instead of `./dist/cli.mjs`
  - Add `publishConfig`, `bugs`, `homepage` fields
  - Add `sideEffects: false` and `./package.json` export
  - Update repository URL format to match other packages

  This fixes the "npm error could not determine executable to run" error when running `npx openapi-to-typescript`.

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
  - @cerios/openapi-core@1.0.0
