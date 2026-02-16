---
"@cerios/openapi-core": minor
"@cerios/openapi-to-zod": patch
"@cerios/openapi-to-zod-playwright": patch
"@cerios/openapi-to-typescript": patch
---

Add RequireExcept utility type and update stripSchemaPrefix to support arrays

### @cerios/openapi-core (minor)

- Add `RequireExcept<T, K>` utility type for creating "resolved options" types where most properties are required but some remain optional
- Update `stripPrefix` function to accept `string | string[]` for stripping multiple prefixes

### @cerios/openapi-to-typescript (patch)

- Simplify `ResolvedOptions` interface using the new `RequireExcept` utility type

### @cerios/openapi-to-zod (patch)

- Update `PropertyGeneratorContext.stripSchemaPrefix` type to `string | string[]` for consistency with `BaseGeneratorOptions`

### @cerios/openapi-to-zod-playwright (patch)

- Update `stripSchemaPrefix` parameter types in service generator functions to support `string | string[]`
