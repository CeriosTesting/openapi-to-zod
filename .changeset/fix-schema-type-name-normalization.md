---
"@cerios/openapi-core": patch
"@cerios/openapi-to-k6": patch
---

Fix schema type name mismatch between types file and service imports

Schema names containing special characters (underscores, dots, hyphens) are now normalized consistently across all generated files. Previously, type names like `Org_Entity_POST` would appear as `Org_Entity_POST` in service imports but `OrgEntityPOST` in the types file, causing TypeScript compilation errors.

**Changes:**

- Added `normalizeSchemaTypeName()` utility to `@cerios/openapi-core` for consistent type name normalization
- Updated K6 service generator to normalize request body and response type names
- Handles array types correctly (e.g., `User_DTO[]` → `UserDTO[]`)
