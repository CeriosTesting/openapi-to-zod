---
"@cerios/openapi-to-zod": patch
---

Prevents defaultNullable from applying to compositions

Fixes incorrect nullable behavior where defaultNullable was being applied to schema composition results (allOf, oneOf, anyOf) when it should only apply to actual property values.

Composition schemas define shapes and types, not property nullability. The defaultNullable option should only affect properties inside object shapes, which is already handled correctly by the inline object shape generator.
