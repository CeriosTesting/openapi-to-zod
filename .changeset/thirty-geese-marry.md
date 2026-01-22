---
"@cerios/openapi-to-zod-playwright": minor
"@cerios/openapi-to-zod": minor
---

Generates named schemas for inline request/response types

Replaces inline Zod schema generation (e.g., `z.string()`, `z.array()`) with named schema types for better type safety and consistency. Inline schemas now receive generated names like `GetUsersResponse` or `PostUsersRequest` and are validated using corresponding Zod schemas from the schemas file.

Improves error formatting by omitting received values for object/array types in validation errors to reduce noise. Fixes regex pattern escaping to prevent double-escaping of forward slashes already escaped in JSON specifications.

Refactors date-time format validation and pattern caching to be instance-level rather than global, enabling parallel-safe generator execution without shared mutable state.