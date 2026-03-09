# @cerios/openapi-to-k6

## 1.2.0

### Minor Changes

- c099aee: **BREAKING:** Added `./runtime` sub-path export to separate k6-safe code from Node.js codegen code.

  ### What changed

  Runtime utilities and types are now **only** exported from `@cerios/openapi-to-k6/runtime`:
  - `buildQueryString`, `cleanBaseUrl`, `mergeRequestParameters`, `serializeBody`, `stringifyHeaders`
  - `HttpHeaders`, `K6ServiceResult`, `Params`, `QueryParams`

  The main entry point (`@cerios/openapi-to-k6`) now only exports codegen utilities.

  ### Why

  The previous single entry point bundled Node.js-dependent code generation with pure runtime utilities. Because the codegen code imports `fs`, `path`, and other Node.js modules, any consumer importing even one runtime utility would pull in `fs`. k6 doesn't support Node.js built-in modules, causing crashes.

  ### Migration

  Generated k6 files now import from `@cerios/openapi-to-k6/runtime` automatically. If you have existing generated files, regenerate them or manually update imports:

  ```diff
  - import { buildQueryString, cleanBaseUrl } from "@cerios/openapi-to-k6";
  + import { buildQueryString, cleanBaseUrl } from "@cerios/openapi-to-k6/runtime";
  ```

  ### Other improvements
  - `mergeRequestParameters` now also deep-merges `cookies` (in addition to `headers` and `tags`)

### Patch Changes

- c099aee: Improved `mergeRequestParameters` to deep-merge `cookies` in addition to `headers` and `tags`.

  Request-level cookie values now override common cookie values while preserving non-conflicting cookies from both sources.

## 1.1.1

### Patch Changes

- 6661d63: Fixed `fileHeader` option not being recognized in config validation.

  **Bug fix:**
  - Added missing `fileHeader` field to `BaseGeneratorOptionsSchema` in openapi-core
  - Added missing `showWarnings` field to `BaseGeneratorOptionsSchema` in openapi-core
  - Fixed K6 generator `generateString()` and `generateServiceString()` to include file headers in output

  This fix ensures the `fileHeader` option works correctly across all packages:
  - `@cerios/openapi-to-k6`
  - `@cerios/openapi-to-typescript`
  - `@cerios/openapi-to-zod`
  - `@cerios/openapi-to-zod-playwright`

  Previously, using `fileHeader` in a K6 config file would cause validation error:

  ```
  Unrecognized key 'fileHeader'. Check for typos in field names.
  ```

- Updated dependencies [6661d63]
  - @cerios/openapi-core@1.1.1
  - @cerios/openapi-to-typescript@1.1.1

## 1.1.0

### Minor Changes

- 28c1e69: Added `fileHeader` option to add custom comment lines at the top of generated files.

  ### New Features

  **Custom file header support (`@cerios/openapi-core`):**
  - Added `generateCustomFileHeader()` utility function
  - Added `fileHeader?: string[]` option to `BaseGeneratorOptions`
  - Each string in the array is output as-is on its own line at the very top of generated files
  - Useful for adding linter disable comments (e.g., oxlint, eslint)

  **Config support (all packages):**
  - `fileHeader` can be set in `defaults` to apply to all specs
  - Individual specs can override or disable (with empty array) the default header

  ### Example Usage

  ```typescript
  export default defineConfig({
  	defaults: {
  		fileHeader: [
  			"// oxlint-disable typescript/no-unsafe-type-assertion",
  			"// oxlint-disable typescript/no-unsafe-assignment",
  		],
  	},
  	specs: [
  		{
  			input: "api.yaml",
  			outputTypes: "schemas.ts",
  		},
  	],
  });
  ```

### Patch Changes

- 28c1e69: Added aligned file headers and configurable warning system across all packages.

  ### Breaking Changes

  **`generateFileHeader()` return type changed (`@cerios/openapi-core`):**
  - Changed return type from `string[]` to `string`
  - Function now returns a formatted string with trailing double newline (`\n\n`)
  - All generators updated to use the new return type

  ### New Features

  **Aligned header generation (`@cerios/openapi-core`):**
  - `generateFileHeader()` now returns a formatted string ready to prepend to generated files
  - Headers include package name, API title/version (when available), and "do not edit" notice
  - All generators now include API metadata (title/version) from the OpenAPI spec in generated file headers

  **Warning collector system (`@cerios/openapi-core`):**
  - Added `WarningCollector` class for deferred warning output
  - Added `createWarningLogger()` factory for direct warning logging
  - Warnings are now displayed in a dedicated section at the end of generation with `⚠️` prefix
  - Added `showWarnings` option to `BaseGeneratorOptions` (default: `true`)

  **Composition warnings wired through generators (`@cerios/openapi-to-zod`):**
  - allOf conflict warnings now flow through `WarningCollector`
  - Empty oneOf/anyOf warnings now flow through `WarningCollector`
  - Discriminator fallback warnings now flow through `WarningCollector`
  - Added `warn` callback to `PropertyGeneratorContext` and `CompositionValidatorContext`

  ### Usage

  To disable warnings during generation:

  ```typescript
  const generator = new ZodGenerator({
  	input: "openapi.yaml",
  	outputTypes: "types.ts",
  	showWarnings: false, // Suppress warning output
  });
  ```

  ### Internal Changes
  - `validateFilters()` and `validateIgnorePatterns()` now accept optional `warn` callback parameter
  - All generator classes use `WarningCollector` for coordinated warning output
  - Composition validators receive `warn` function through context
  - Removed private `generateFileHeader()` wrapper method from openapi-to-k6

- 28c1e69: Fixed duplicate header comments in generated files:
  - **openapi-to-k6**: Types file no longer shows both `@cerios/openapi-to-k6` and `@cerios/openapi-to-typescript` headers
  - **openapi-to-zod**: Types file (when using `outputZodSchemas`) now shows `@cerios/openapi-to-zod` header instead of `@cerios/openapi-to-typescript`
  - **openapi-to-zod-playwright**: Types and schemas files now show `@cerios/openapi-to-zod-playwright` header consistently

  Added internal `includeHeader` option for downstream package coordination:
  - `InternalTypeScriptGeneratorOptions` in openapi-to-typescript
  - `InternalOpenApiGeneratorOptions` in openapi-to-zod

  These internal types are exported but not part of the public API - they allow downstream generators to suppress headers and add their own branding.

- 28c1e69: Removed unnecessary empty object fallback in header spread

  The generated service code now uses `{ ...requestParameters.headers, ...headers }` instead of `{ ...(requestParameters.headers || {}), ...headers }`. Spreading falsy values in object literals is safe and doesn't add unexpected properties, making the fallback redundant.

- Updated dependencies [28c1e69]
- Updated dependencies [28c1e69]
- Updated dependencies [28c1e69]
  - @cerios/openapi-core@1.1.0
  - @cerios/openapi-to-typescript@1.1.0

## 1.0.1

### Patch Changes

- 2204ab7: Fix schema type name mismatch between types file and service imports

  Schema names containing special characters (underscores, dots, hyphens) are now normalized consistently across all generated files. Previously, type names like `Org_Entity_POST` would appear as `Org_Entity_POST` in service imports but `OrgEntityPOST` in the types file, causing TypeScript compilation errors.

  **Changes:**
  - Added `normalizeSchemaTypeName()` utility to `@cerios/openapi-core` for consistent type name normalization
  - Updated K6 service generator to normalize request body and response type names
  - Handles array types correctly (e.g., `User_DTO[]` → `UserDTO[]`)

- Updated dependencies [2204ab7]
  - @cerios/openapi-core@1.0.1
  - @cerios/openapi-to-typescript@1.0.1

## 1.0.0

### Minor Changes

- 5fbc8d0: Add client-service split architecture for K6 generation
  - **Client (passthrough layer)**: Now returns raw K6 `Response` directly instead of `{ response, data }`. No JSON parsing - pure wrapper around K6's `http` module.

  - **Service (validation layer)**: New optional layer that wraps the client with:
    - Status code validation using K6's `check()` function with console logging on failure
    - JSON response body parsing
    - Returns `K6ServiceResult<T>` with `response`, `data`, and `ok` properties

  - **New `K6ServiceResult<T>` type**: Generic type combining HTTP response with parsed data and status check result:

    ```typescript
    interface K6ServiceResult<T> {
    	response: Response; // Raw K6 HTTP response
    	data: T; // Parsed response data (typed from OpenAPI spec)
    	ok: boolean; // Whether status code check passed
    }
    ```

  - **New `outputService` option**: Specify a file path to generate the service layer alongside the client

  - **Breaking change**: Client methods now return `Response` instead of `{ response: Response; data: T }`. Use the new service layer for the previous behavior with added validation.

- 5fbc8d0: Add Content-Type header injection and body serialization for K6 client/service

  ## Client Changes
  - **Content-Type header injection**: Client methods now automatically include the `Content-Type` header from the OpenAPI spec for endpoints with request bodies. User-provided headers can still override this default.

  - **Consistent naming**: Changed `requestParams` to `requestParameters` throughout for consistency between client and service.

  ## Service Changes
  - **`serializeBody()` helper**: New runtime helper function that handles K6's various body types:
    - `null`/`undefined`: passed through as-is
    - `string`: passed through as-is (already serialized)
    - `ArrayBuffer`: passed through as-is (binary data)
    - `FileData` (K6 type): passed through as-is
    - Objects: JSON.stringify'd

  - **Simplified method bodies**:
    - Removed unnecessary `mergedRequestParameters` variable
    - Removed `params as Record<string, string>` type casting
    - Header merging now directly modifies `requestParameters` instead of a copy

  ## Generated Code Example

  **Client method:**

  ```typescript
  createUser(options?: { requestParameters?: Params; body?: RequestBody | null }): Response {
    const url = this.baseUrl + `/users`;
    const mergedParams = mergeRequestParameters(
      options?.requestParameters || {},
      this.commonRequestParameters
    );

    return http.request("POST", url, options?.body, {
      ...mergedParams,
      headers: {
        "Content-Type": "application/json",
        ...mergedParams?.headers,
      },
    });
  }
  ```

  **Service method:**

  ```typescript
  createUser(body: CreateUserRequest, requestParameters?: Params): K6ServiceResult<User> {
    const response = this._client.createUser({ requestParameters, body: serializeBody(body) });
    // ... status validation and return
  }
  ```

- 5fbc8d0: ### Features
  - Add `outputTypes` option to generate TypeScript types in a separate file
    - When specified, parameter types (e.g., `GetUsersParams`, `GetUsersHeaders`) are generated to a separate file
    - The client file imports types from the separate file
    - CLI flag: `-t, --output-types <path>`
    - Config: `outputTypes: "k6/api-types.ts"`

  ### Bug Fixes
  - Fix property quoting for parameter names with special characters
    - Property names like `filter[id]`, `page[number]`, and headers with dashes are now properly quoted
    - Before: `filter[id]?: string;` (invalid TypeScript)
    - After: `"filter[id]"?: string;` (valid TypeScript)

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
  - @cerios/openapi-to-typescript@1.0.0
  - @cerios/openapi-core@1.0.0
