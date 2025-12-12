# @cerios/openapi-to-zod-playwright

Generate type-safe Playwright API clients from OpenAPI specifications with Zod validation.

## Features

- 🎭 **Playwright Integration**: Uses `ApiRequestContext` for API testing
- 🔒 **Type Safety**: Full TypeScript support with Zod schemas
- 🎯 **Two-Layer Architecture**: Thin client layer + validated service layer
- ✅ **Automatic Validation**: Request and response validation with Zod
- 🧪 **Testing Friendly**: Separate error methods for testing failure scenarios
- 📝 **Status Code Validation**: Uses Playwright's `expect()` for status checks
- 🔄 **Multiple Responses**: Separate methods per status code when needed

## Installation

```bash
npm install @cerios/openapi-to-zod-playwright @playwright/test zod
```

> **Note:** `@cerios/openapi-to-zod` is installed automatically as a dependency.

## Quick Start

### 1. Initialize Configuration

```bash
npx openapi-to-zod-playwright --init
```

This will guide you through creating a configuration file:

```
? Input OpenAPI file path: openapi.yaml
? Output TypeScript file path: tests/api-client.ts
? Config file format: TypeScript (recommended)
? Include commonly-used defaults? Yes
```

Creates `openapi-to-zod-playwright.config.ts`:

```typescript
import { defineConfig } from '@cerios/openapi-to-zod-playwright';

export default defineConfig({
  defaults: {
    mode: 'normal',
    validateServiceRequest: false,
  },
  specs: [
    {
      input: 'openapi.yaml',
      output: 'tests/api-client.ts',
    },
  ],
});
```

### 2. Generate Client

```bash
npx openapi-to-zod-playwright
```

### 3. Use in Tests

```typescript
import { test, expect } from '@playwright/test';
import { ApiClient, ApiService } from './api-client';

test('create and get user', async ({ request }) => {
  const client = new ApiClient(request);
  const service = new ApiService(client);

  // Create user - validates request and response
  const user = await service.postUsers201({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      age: 25
    }
  });

  expect(user.email).toBe('test@example.com');

  // Get user by ID
  const fetchedUser = await service.getUsersByUserId(user.id);
  expect(fetchedUser.id).toBe(user.id);
});

test('handle error response', async ({ request }) => {
  const client = new ApiClient(request);
  const service = new ApiService(client);

  // Test error scenario
  const response = await service.postUsersError({
    data: { email: 'invalid' } // Missing required 'name'
  });

  expect(response.status()).toBe(400);
});
```

## Architecture

This package generates two layers:

### 1. ApiClient (Thin Passthrough Layer)

- Direct passthrough to Playwright's `ApiRequestContext`
- No validation - allows testing invalid requests
- All request properties are `Partial<>` for flexibility
- Returns raw `APIResponse`

```typescript
const client = new ApiClient(request);

// Can send invalid data for testing
const response = await client.postUsers({
  data: { invalid: 'data' }
});
```

### 2. ApiService (Validated Layer)

- Validates requests with Zod schemas
- Validates response status with Playwright `expect()`
- Validates response bodies with Zod schemas
- Separate methods per status code for multiple responses
- Generic error methods for testing failures

```typescript
const service = new ApiService(client);

// Validates request and response - throws on invalid data
const user = await service.postUsers201({
  data: { email: 'test@example.com', name: 'Test' }
});
```

## Method Naming

Methods are named using the pattern: `{httpMethod}{PascalCasePath}{StatusCode?}`

Examples:
- `GET /users` → `getUsers()` (single 200 response)
- `POST /users` → `postUsers201()` (201 response)
- `GET /users/{userId}` → `getUsersByUserId(userId: string)` (single 200 response)
- `DELETE /users/{userId}` → `deleteUsersByUserId(userId: string)` (204 response)
- `POST /users` → `postUsersError()` (error testing method)

### Status Code Suffixes

- **Single response**: No suffix (e.g., `getUsers()`)
- **Multiple responses**: Status code suffix per method (e.g., `postUsers200()`, `postUsers201()`)
- **Error methods**: `Error` suffix for testing failures (e.g., `getUsersByUserIdError()`)

## CLI Usage

### Initialize a New Config File

```bash
npx openapi-to-zod-playwright --init
```

Interactive prompts guide you through:
- Input OpenAPI file path
- Output file path
- Config format (TypeScript or JSON)
- Whether to include common defaults

### Generate from Config

```bash
# Auto-discovers openapi-to-zod-playwright.config.{ts,json}
npx openapi-to-zod-playwright

# Or specify config file explicitly
npx openapi-to-zod-playwright --config path/to/config.ts
```

### Other Commands

```bash
# Display version
npx openapi-to-zod-playwright --version

# Display help
npx openapi-to-zod-playwright --help
```

## Configuration File

### TypeScript Configuration (Recommended)

**`openapi-to-zod-playwright.config.ts`**:

```typescript
import { defineConfig } from '@cerios/openapi-to-zod-playwright';

export default defineConfig({
  defaults: {
    mode: 'strict',
    includeDescriptions: true,
    showStats: false
  },
  specs: [
    {
      input: 'specs/api-v1.yaml',
      output: 'src/generated/api-v1.ts'
    },
    {
      input: 'specs/api-v2.yaml',
      output: 'src/generated/api-v2.ts',
      outputClient: 'src/generated/api-v2-client.ts',
      outputService: 'src/generated/api-v2-service.ts', // Automatically enables service generation
      mode: 'normal',
      prefix: 'v2'
    }
  ],
  executionMode: 'parallel' // or 'serial'
});
```

### JSON Configuration

**`openapi-to-zod-playwright.config.json`**:

```json
{
  "defaults": {
    "mode": "strict",
    "includeDescriptions": true,
    "showStats": false
  },
  "specs": [
    {
      "input": "specs/api-v1.yaml",
      "output": "src/generated/api-v1.ts"
    },
    {
      "input": "specs/api-v2.yaml",
      "output": "src/generated/api-v2.ts",
      "mode": "normal",
      "prefix": "v2"
    }
  ],
  "executionMode": "parallel"
}
```

### Configuration Options

- **`defaults`**: Default options applied to all specs
- **`specs`**: Array of spec configurations (per-spec options override defaults)
- **`executionMode`**: `"parallel"` (default) or `"serial"`

Each spec supports all generator options. See the [Configuration Reference](#configuration-reference) below.

## Migration from v1.x

**Breaking Change:** CLI options have been removed in v2.0. You must use a configuration file.

### Before (v1.x)

```bash
openapi-to-zod-playwright -i openapi.yaml -o src/api.ts --mode strict
```

### After (v2.0)

1. Run `--init` to create a config file:

```bash
npx openapi-to-zod-playwright --init
```

2. Customize the generated config file as needed
3. Run without options:

```bash
npx openapi-to-zod-playwright
```

## Response Handling

### Success Responses

```typescript
// 200 OK with body
const users = await service.getUsers(); // Promise<User[]>

// 201 Created with body
const user = await service.postUsers201({ data: userData }); // Promise<User>

// 204 No Content
const result = await service.deleteUsersByUserId(userId); // Promise<null>
```

### Error Responses

```typescript
// Test error scenarios without validation
const response = await service.getUsersByUserIdError('invalid-id');
expect(response.status()).toBe(404);

const errorBody = await response.json();
expect(errorBody.message).toContain('not found');
```

## Path Parameters

Path parameters are extracted and become required method arguments in path order:

```yaml
paths:
  /orgs/{orgId}/repos/{repoId}:
    get:
      # ...
```

Generated:

```typescript
// Path params in order
async getOrgsByOrgIdReposByRepoId(
  orgId: string,
  repoId: string,
  options?: { query?: Record<string, any> }
): Promise<Repo>
```

## Request Options

All optional request properties are grouped in an `options` parameter:

```typescript
interface RequestOptions {
  query?: Record<string, any>;      // Query parameters
  headers?: Record<string, string>; // Request headers
  data?: T;                          // Request body (JSON)
  form?: Record<string, any>;        // Form data
  multipart?: Record<string, any>;   // Multipart form data
}
```

### Service Layer (Validated)

```typescript
await service.postUsers201({
  data: { email: 'test@example.com', name: 'Test User' }, // Validated with Zod
  headers: { 'X-Custom': 'value' }
});
```

### Client Layer (Passthrough)

```typescript
// All properties are Partial - allows invalid data
await client.postUsers({
  data: { invalid: 'data' } // No validation
});
```

## Testing Patterns

### Happy Path Testing

```typescript
test('successful user creation', async ({ request }) => {
  const service = new ApiService(new ApiClient(request));

  const user = await service.postUsers201({
    data: { email: 'test@example.com', name: 'Test' }
  });

  // Automatically validated: status 201, response matches User schema
  expect(user.id).toBeTruthy();
});
```

### Error Testing

```typescript
test('handle validation errors', async ({ request }) => {
  const service = new ApiService(new ApiClient(request));

  const response = await service.postUsersError({
    data: { email: 'invalid' } // Missing required 'name'
  });

  expect(response.status()).toBe(400);
  const error = await response.json();
  expect(error.message).toContain('validation');
});
```

### Invalid Request Testing

```typescript
test('send invalid data', async ({ request }) => {
  const client = new ApiClient(request);

  // Use client directly to bypass validation
  const response = await client.postUsers({
    data: { completely: 'wrong' }
  });

  expect(response.status()).toBe(400);
});
```

## License

MIT © Ronald Veth - Cerios
