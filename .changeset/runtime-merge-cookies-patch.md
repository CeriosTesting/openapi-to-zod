---
"@cerios/openapi-to-k6": patch
---

Improved `mergeRequestParameters` to deep-merge `cookies` in addition to `headers` and `tags`.

Request-level cookie values now override common cookie values while preserving non-conflicting cookies from both sources.
