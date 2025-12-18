---
"@cerios/openapi-to-zod-playwright": patch
---

Adds stripSchemaPrefix support to service generator

Extends the service generator to support stripping prefixes from schema names before converting them to TypeScript identifiers. This prevents naming conflicts and improves code readability when OpenAPI schemas use prefixed naming conventions.

Applies the prefix stripping consistently across schema references, inline schemas, and type name generation to ensure all generated identifiers follow the same naming pattern.

Refactors client generator's serializeParams method to improve type safety and code clarity by explicitly handling each parameter type case separately instead of relying on a single conditional check.