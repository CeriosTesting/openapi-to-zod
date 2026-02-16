---
"@cerios/openapi-core": minor
"@cerios/openapi-to-zod": minor
"@cerios/openapi-to-zod-playwright": minor
"@cerios/openapi-to-typescript": minor
"@cerios/openapi-to-k6": minor
---

Renamed `output` to `outputTypes` as the canonical config field.

This change improves clarity by explicitly indicating that the output path is for generated types/schemas, distinguishing it from other output options like `outputClient` and `outputService` in the Playwright and K6 packages.

For `@cerios/openapi-to-zod` and `@cerios/openapi-to-zod-playwright`, backward compatibility is now included:

- `outputTypes` is the preferred field.
- Deprecated `output` is still accepted.
- One of `outputTypes` or `output` is required.
- If both are set and values differ, configuration validation fails.
- A deprecation warning is shown in terminal output when `output` is used.

### Migration Guide

Use `outputTypes` going forward:

**Before:**

```json
{
	"specs": [
		{
			"input": "openapi.yaml",
			"output": "src/schemas.ts"
		}
	]
}
```

**After:**

```json
{
	"specs": [
		{
			"input": "openapi.yaml",
			"outputTypes": "src/schemas.ts"
		}
	]
}
```

**TypeScript config:**

```typescript
export default defineConfig({
	specs: [
		{
			input: "openapi.yaml",
			outputTypes: "src/schemas.ts", // Previously: output
			outputClient: "src/client.ts",
			outputService: "src/service.ts",
		},
	],
});
```

### Affected Packages

- `@cerios/openapi-core`: `BaseGeneratorOptions.output` → `BaseGeneratorOptions.outputTypes`
- `@cerios/openapi-to-zod`: Config files and `OpenApiGeneratorOptions` (`output` remains supported as deprecated alias)
- `@cerios/openapi-to-zod-playwright`: Config files and `OpenApiPlaywrightGeneratorOptions` (`output` remains supported as deprecated alias)
- `@cerios/openapi-to-typescript`: Config files and `TypeScriptGeneratorOptions`
- `@cerios/openapi-to-k6`: Config files and `OpenApiK6GeneratorOptions`
