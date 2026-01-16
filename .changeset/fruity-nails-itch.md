---
"@cerios/openapi-to-zod-playwright": patch
"@cerios/openapi-to-zod": patch
---

Changes default for useOperationId to false

Changes the default behavior for method name generation from operationId-based to path-based naming, providing more predictable and consistent method names by default.

Adds support for $ref resolution in OpenAPI parameters, request bodies, and responses, enabling proper handling of reusable component definitions throughout the spec.

Implements path-level parameter merging so that parameters defined at the path level are correctly inherited by all operations on that path, following OpenAPI specification.

Improves Zod v4 compatibility by using dedicated format validators (email, url, uuid) as top-level validators instead of string refinements.