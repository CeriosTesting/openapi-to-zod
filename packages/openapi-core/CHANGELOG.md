# @cerios/openapi-core

## 1.0.0

### Minor Changes

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

### Patch Changes

- 5fbc8d0: ### Bug Fixes
  - Fix path-based method naming when OpenAPI path segments contain `@`.
  - Replace `@` with `At` during path-to-method-name normalization (for both regular path segments and `{pathParams}`).
  - Ensures generated client and service methods are valid TypeScript identifiers and no longer contain literal `@` in method names.

  ### Examples
  - `/feeds/@channel/{channelId}` now generates `getFeedsAtChannelByChannelId` (instead of including `@` in the method name).

- 5fbc8d0: Fix TypeScript config loader to resolve modules from user's project directory

  The TypeScript config loader now uses `createRequire(filepath)` to create a require function that resolves modules relative to the config file's location. This fixes the issue where config files importing from packages like `@cerios/openapi-to-typescript` would fail with "Cannot find module" errors because modules were being resolved from the CLI's installation location instead of the user's project.
