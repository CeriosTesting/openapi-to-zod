---
"@cerios/openapi-to-k6": patch
"@cerios/openapi-to-zod": patch
"@cerios/openapi-to-zod-playwright": patch
"@cerios/openapi-to-typescript": patch
---

### Bug Fixes

**@cerios/openapi-to-k6**

- Fix output files being swapped - client was written to types path and vice versa
- Fix import path calculation for types file - now correctly computes relative path from client file to types file
- Fix schema types (response and request body types) not being imported in client file when using separate types file
- Add `enumFormat` configuration option (inherited from TypeScript generator)
- K6 config schema now properly extends TypeScript config schema
- Move runtime utilities (`mergeRequestParameters`, `stringifyHeaders`, `buildQueryString`, `cleanBaseUrl`) to a separate runtime module that is imported by generated clients instead of being generated inline

**@cerios/openapi-to-typescript**

- Export `TypeScriptSpecificOptionsSchema`, `TypeScriptGeneratorOptionsSchema`, and `TypeScriptDefaultsSchema` for use by downstream packages

**All packages**

- Replace deprecated Zod v4 `.merge()` method with `.extend()` for schema composition
