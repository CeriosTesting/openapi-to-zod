---
"@cerios/openapi-to-zod-playwright": patch
---

Fixed Zod error formatting in `formatZodErrorWithValues`:

- Fixed path traversal for array indices - values at array paths like `data[0].operation` now resolve correctly instead of showing `undefined`
- Skip redundant `(received: ...)` suffix when the Zod error message already contains "received" (e.g., "expected object, received null")
- Skip `(received: ...)` for unrecognized key errors where the value would point to the parent object
