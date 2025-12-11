# @cerios/openapi-to-zod

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
