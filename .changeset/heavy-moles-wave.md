---
"@cerios/openapi-to-zod-playwright": patch
"@cerios/openapi-to-zod": patch
---

Fixed the filtering in the schemas and types in openapi-to-zod based on operationFilters in openapi-to-zod-playwright package.

Glob Pattern Support for Path Prefixes: The stripPathPrefix option in openapi-to-zod-playwright now exclusively supports glob patterns (using minimatch), replacing previous regex-based or RegExp support. This affects the generator’s TypeScript types, implementation, and documentation.
