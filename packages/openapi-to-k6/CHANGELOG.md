# @cerios/openapi-to-k6

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
