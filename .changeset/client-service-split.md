---
"@cerios/openapi-to-k6": minor
---

Add client-service split architecture for K6 generation

- **Client (passthrough layer)**: Now returns raw K6 `Response` directly instead of `{ response, data }`. No JSON parsing - pure wrapper around K6's `http` module.

- **Service (validation layer)**: New optional layer that wraps the client with:
  - Status code validation using K6's `check()` function with console logging on failure
  - JSON response body parsing
  - Returns `K6ServiceResult<T>` with `response`, `data`, and `ok` properties

- **New `K6ServiceResult<T>` type**: Generic type combining HTTP response with parsed data and status check result:

  ```typescript
  interface K6ServiceResult<T> {
  	response: Response; // Raw K6 HTTP response
  	data: T; // Parsed response data (typed from OpenAPI spec)
  	ok: boolean; // Whether status code check passed
  }
  ```

- **New `outputService` option**: Specify a file path to generate the service layer alongside the client

- **Breaking change**: Client methods now return `Response` instead of `{ response: Response; data: T }`. Use the new service layer for the previous behavior with added validation.
