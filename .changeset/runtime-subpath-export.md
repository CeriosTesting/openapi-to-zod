---
"@cerios/openapi-to-k6": minor
---

**BREAKING:** Added `./runtime` sub-path export to separate k6-safe code from Node.js codegen code.

### What changed

Runtime utilities and types are now **only** exported from `@cerios/openapi-to-k6/runtime`:

- `buildQueryString`, `cleanBaseUrl`, `mergeRequestParameters`, `serializeBody`, `stringifyHeaders`
- `HttpHeaders`, `K6ServiceResult`, `Params`, `QueryParams`

The main entry point (`@cerios/openapi-to-k6`) now only exports codegen utilities.

### Why

The previous single entry point bundled Node.js-dependent code generation with pure runtime utilities. Because the codegen code imports `fs`, `path`, and other Node.js modules, any consumer importing even one runtime utility would pull in `fs`. k6 doesn't support Node.js built-in modules, causing crashes.

### Migration

Generated k6 files now import from `@cerios/openapi-to-k6/runtime` automatically. If you have existing generated files, regenerate them or manually update imports:

```diff
- import { buildQueryString, cleanBaseUrl } from "@cerios/openapi-to-k6";
+ import { buildQueryString, cleanBaseUrl } from "@cerios/openapi-to-k6/runtime";
```

### Other improvements

- `mergeRequestParameters` now also deep-merges `cookies` (in addition to `headers` and `tags`)
