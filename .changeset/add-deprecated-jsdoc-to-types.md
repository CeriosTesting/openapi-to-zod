---
"@cerios/openapi-to-typescript": patch
---

### Feature: Add @deprecated JSDoc to TypeScript type properties

Properties marked with `deprecated: true` in OpenAPI schemas now include a `@deprecated` JSDoc tag in the generated TypeScript types.

**Behavior:**

- Deprecated-only property: `/** @deprecated */`
- Description + deprecated: `/** The description @deprecated */`
- The `@deprecated` tag is always added regardless of the `includeDescriptions` option

**Example:**

OpenAPI spec:

```yaml
properties:
  legacyId:
    type: string
    deprecated: true
  oldName:
    type: string
    description: The old name field
    deprecated: true
```

Generated TypeScript:

```typescript
/** @deprecated */
legacyId?: string;
/** The old name field @deprecated */
oldName?: string;
```
