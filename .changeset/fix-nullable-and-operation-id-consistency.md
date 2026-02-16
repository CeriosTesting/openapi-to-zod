---
"@cerios/openapi-to-typescript": patch
"@cerios/openapi-to-zod-playwright": patch
---

### Fix: Nullable type consistency in separate schemas mode

Fixed a TypeScript error that occurred when using separate schemas mode (`outputZodSchemas`) with nullable properties.

**The Problem:**
When a property has `nullable: true` in the OpenAPI spec:

- Zod schema generated: `z.string().nullable()` → infers to `string | null`
- TypeScript type was generating: `string` or `string | undefined` (missing `| null`)

This caused TypeScript errors like:

```
Type 'string | null | undefined' is not assignable to type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
```

**The Solution:**
The TypeScript generator now correctly handles `nullable: true` (OpenAPI 3.0) and `type: [string, null]` (OpenAPI 3.1) and generates `| null` in the TypeScript type:

```typescript
// Before (broken)
export type User = {
	email?: string; // Missing | null
};

// After (fixed)
export type User = {
	email?: string | null; // Correctly includes | null
};
```

**What was fixed:**

- Nullable handling for `$ref` properties
- Nullable handling for inline object properties
- Nullable handling for array types
- Nullable handling for enum types
- Nullable handling for primitive type aliases
- Nullable handling for `allOf`, `oneOf`, `anyOf` compositions
- OpenAPI 3.1 type arrays with null (e.g., `type: [string, null]`)

### Fix: Consistent useOperationId behavior across generators

Fixed an issue where the `useOperationId` option was being ignored in several places, causing inconsistent naming between service methods, types, and schemas.

**The Problem:**
When `useOperationId: false` was set:

- Service methods correctly used path-based names: `getApiUsers()`
- But types were generated with operationId-based names: `SearchUsersQueryParams`

This caused TypeScript errors because the service imported types that didn't exist.

**Root Cause:**
Multiple places hardcoded `useOperationId: true`:

- `generateSchemasString()` forced `useOperationId: true` for schema generator
- `generateTypesString()` didn't pass `useOperationId` to TypeScriptGenerator
- `extractEndpoints()` hardcoded `true` in `getOperationName()` calls for QueryParams, HeaderParams, and inline response names

**The Solution:**
All generators now consistently use the passed `useOperationId` setting:

```typescript
// With useOperationId: false (path-based naming)
async getApiUsers(options?: { params?: GetApiUsersQueryParams })

// With useOperationId: true (operationId-based naming)
async searchUsers(options?: { params?: SearchUsersQueryParams })
```

**What was fixed:**

- `generateSchemasString()` no longer overrides `useOperationId`
- `generateTypesString()` passes `useOperationId` to TypeScriptGenerator
- `extractEndpoints()` uses the passed `useOperationId` for all type names
- `hasMultipleStatuses` now only counts 2xx responses (was incorrectly counting 4xx/5xx)
