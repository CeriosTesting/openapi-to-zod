---
"@cerios/openapi-core": patch
"@cerios/openapi-to-zod-playwright": patch
---

### Bug Fixes

- Fix path-based method naming when OpenAPI path segments contain `@`.
- Replace `@` with `At` during path-to-method-name normalization (for both regular path segments and `{pathParams}`).
- Ensures generated client and service methods are valid TypeScript identifiers and no longer contain literal `@` in method names.

### Examples

- `/feeds/@channel/{channelId}` now generates `getFeedsAtChannelByChannelId` (instead of including `@` in the method name).
