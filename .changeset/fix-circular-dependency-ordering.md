---
"@cerios/openapi-to-zod": patch
"@cerios/openapi-to-zod-playwright": patch
---

Fix "used before its declaration" TypeScript errors for circular dependencies

### @cerios/openapi-to-zod (patch)

Fixed a bug where schemas involved in mutual circular dependencies (e.g., `Dossier → AbsenceCourse → Dossier` via `allOf` compositions) would cause TypeScript compilation errors due to variables being used before their declaration.

**Root cause**: The generator was not properly detecting and handling mutual circular references. When schemas reference each other through `allOf`, the topological sort would place them in an order that caused forward references without using `z.lazy()`.

**Changes**:

- Added pre-analysis phase to detect circular dependency chains before code generation
- References to any schema in a circular dependency chain now use `z.lazy()` for deferred evaluation
- Fixed an issue where new `PropertyGenerator` instances weren't receiving the circular dependencies information
- Improved topological sort to defer schemas that depend on circular dependencies

### @cerios/openapi-to-zod-playwright (patch)

- Inherits the circular dependency fix from `@cerios/openapi-to-zod`
