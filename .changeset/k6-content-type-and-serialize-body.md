---
"@cerios/openapi-to-k6": minor
---

Add Content-Type header injection and body serialization for K6 client/service

## Client Changes

- **Content-Type header injection**: Client methods now automatically include the `Content-Type` header from the OpenAPI spec for endpoints with request bodies. User-provided headers can still override this default.

- **Consistent naming**: Changed `requestParams` to `requestParameters` throughout for consistency between client and service.

## Service Changes

- **`serializeBody()` helper**: New runtime helper function that handles K6's various body types:
  - `null`/`undefined`: passed through as-is
  - `string`: passed through as-is (already serialized)
  - `ArrayBuffer`: passed through as-is (binary data)
  - `FileData` (K6 type): passed through as-is
  - Objects: JSON.stringify'd

- **Simplified method bodies**:
  - Removed unnecessary `mergedRequestParameters` variable
  - Removed `params as Record<string, string>` type casting
  - Header merging now directly modifies `requestParameters` instead of a copy

## Generated Code Example

**Client method:**

```typescript
createUser(options?: { requestParameters?: Params; body?: RequestBody | null }): Response {
  const url = this.baseUrl + `/users`;
  const mergedParams = mergeRequestParameters(
    options?.requestParameters || {},
    this.commonRequestParameters
  );

  return http.request("POST", url, options?.body, {
    ...mergedParams,
    headers: {
      "Content-Type": "application/json",
      ...mergedParams?.headers,
    },
  });
}
```

**Service method:**

```typescript
createUser(body: CreateUserRequest, requestParameters?: Params): K6ServiceResult<User> {
  const response = this._client.createUser({ requestParameters, body: serializeBody(body) });
  // ... status validation and return
}
```
