---
"@cerios/openapi-core": minor
"@cerios/openapi-to-typescript": minor
"@cerios/openapi-to-zod": minor
"@cerios/openapi-to-k6": minor
---

Add `useOperationId` parity for operation-derived naming across generators.

## What changed

- **Core**: Added shared `useOperationId` option to base generator config/types and extended `getOperationName()` to support explicit operationId toggle behavior.
- **openapi-to-typescript**:
  - Added `useOperationId` support for operation-derived type names (`QueryParams`, `HeaderParams`, inline request/response types).
  - Default behavior remains unchanged (`useOperationId: true`).
- **openapi-to-zod**:
  - Added `useOperationId` support for operation-derived query/header schema names.
  - Default behavior remains unchanged (`useOperationId: true`).
- **openapi-to-k6**:
  - Forwarded `useOperationId` into internal `openapi-to-typescript` schema type generation, so generated operation-derived type names match client/service naming mode.

## Notes

- Existing default naming remains backward compatible.
- Added/updated tests in TypeScript, Zod, and K6 packages to verify both naming modes.
