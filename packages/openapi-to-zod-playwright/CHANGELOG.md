# @cerios/openapi-to-zod-playwright

## 0.3.0

### Minor Changes

- - Simplifies generator logic by removing CLI option merging and focusing solely on config-based generation with better error messages when config files are missing.
  - Adds interactive --init command to guide users through creating config files with prompts for input/output paths, format selection (TypeScript/JSON), and optional commonly-used defaults.

### Patch Changes

- Updated dependencies
  - @cerios/openapi-to-zod@0.3.0

## 0.2.0

### Minor Changes

- Adds query parameter schema generation and fixes test configuration

  - Generates typed query parameter schemas from OpenAPI path operations, improving type safety for API client methods. Query parameters with arrays are automatically serialized as comma-separated strings to match Playwright's expected format.

  - Derives client and service class names from output file paths to support multiple API clients in the same project, avoiding hardcoded "ApiClient" and "ApiService" names.

  - Fixes TypeScript enum generation to use z.nativeEnum() instead of z.enum() for proper validation. Improves schema dependency sorting to handle circular dependencies by placing them after their non-circular dependencies.

### Patch Changes

- Updated dependencies
  - @cerios/openapi-to-zod@0.2.0

## 0.1.4

### Patch Changes

- Prevents file write errors when output directories don't exist by creating them recursively before writing generated files.
- Updated dependencies
  - @cerios/openapi-to-zod@0.1.2

## 0.1.3

### Patch Changes

- es-build fix
- Updated dependencies
  - @cerios/openapi-to-zod@0.1.1

## 0.1.2

### Patch Changes

- working config file

## 0.1.1

### Patch Changes

- 8a6b1f3: Added functionality for config file

## 0.1.0

### Minor Changes

- initial version
