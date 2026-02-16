---
"@cerios/openapi-core": minor
"@cerios/openapi-to-zod": minor
"@cerios/openapi-to-zod-playwright": patch
"@cerios/openapi-to-typescript": patch
---

Consolidate duplicate utilities across packages

### @cerios/openapi-core (minor)

- Export `capitalize` function for converting strings to PascalCase (handles kebab-case, snake_case, and dots)
- Export `applyFormatting` function for applying prefix/suffix formatting to names

### @cerios/openapi-to-zod (BREAKING)

- Removed `utils/typescript-loader.ts` re-export. Import directly from `@cerios/openapi-core`:
  ```ts
  // Before
  import { createTypeScriptLoader } from "@cerios/openapi-to-zod/utils/typescript-loader";
  // After
  import { createTypeScriptLoader } from "@cerios/openapi-core";
  ```
- Removed `utils/content-type-utils.ts` re-export. Import directly from `@cerios/openapi-core`:
  ```ts
  // Before
  import { getResponseParseMethod } from "@cerios/openapi-to-zod/utils/content-type-utils";
  // After
  import {
  	getResponseParseMethod,
  	type ContentTypeParseResult,
  	type FallbackContentTypeParsing,
  } from "@cerios/openapi-core";
  ```
- Refactored internal code to use `capitalize` and `generateMethodNameFromPath` from `@cerios/openapi-core`

### @cerios/openapi-to-zod-playwright (patch)

- Use `capitalize` from `@cerios/openapi-core` instead of local duplicate
- Fixed incorrect JSDoc (function produces PascalCase, not camelCase)
- Removed dead code (identical if/else branches)

### @cerios/openapi-to-typescript (patch)

- Use `applyFormatting` from `@cerios/openapi-core` instead of local duplicates in `typescript-generator.ts`, `type-generator.ts`, and `enum-generator.ts`
