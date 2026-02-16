---
"@cerios/openapi-core": minor
"@cerios/openapi-to-typescript": patch
---

### @cerios/openapi-core

Added `stringToEnumMember` and `numericToEnumMember` utilities for generating unique TypeScript enum member names:

- Handles `-` prefix by appending `Desc` suffix (e.g., `-externalKey` → `ExternalkeyDesc`)
- Handles `+` prefix by appending `Asc` suffix (e.g., `+date` → `DateAsc`)
- Supports deduplication via optional `Set<string>` parameter to prevent duplicate keys
- Fallback numeric suffix for remaining collisions (e.g., `foo_bar`, `foo-bar` → `FooBar`, `FooBar2`)

### @cerios/openapi-to-typescript

**Fixed duplicate enum keys** - Sort option enums like `["externalKey", "-externalKey", "name", "-name"]` now correctly generate unique member names:

```typescript
export enum GetEmployeeSortOptions {
	Externalkey = "externalKey",
	ExternalkeyDesc = "-externalKey",
	Name = "name",
	NameDesc = "-name",
}
```

**Fixed allOf with type: object** - Schemas that have both `type: object` and `allOf` now correctly generate intersection types instead of empty objects:

```yaml
ParentBillableResource:
  type: object
  allOf:
    - $ref: "#/components/schemas/BaseEntity"
```

Now correctly generates:

```typescript
export type ParentBillableResource = BaseEntity;
```
