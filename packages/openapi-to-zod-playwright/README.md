# @cerios/openapi-to-zod-playwright

Generate type-safe Playwright API clients from OpenAPI specifications with Zod validation.

## Features

### Playwright-Specific Features

- 🎭 **Playwright Integration**: Uses `ApiRequestContext` for API testing
- 🎯 **Two-Layer Architecture**: Thin client layer + validated service layer
- 🧪 **Testing Friendly**: Separate error methods for testing failure scenarios
- 📝 **Status Code Validation**: Uses Playwright's `expect()` for status checks
- 🔄 **Multiple Responses**: Separate methods per status code when needed
- 📁 **File Splitting**: Separate files for schemas, client, and service layers
- 🎨 **Method Naming**: Automatic method names from paths or operationIds
- 🔍 **Status Code Filtering**: Include/exclude specific status codes (e.g., `includeStatusCodes: ["2xx"]`)
- 🚫 **Header Filtering**: Ignore specific headers with glob patterns (e.g., `ignoreHeaders: ["Authorization"]`)
- 🔗 **Base Path Support**: Prepend common base paths to all endpoints (e.g., `basePath: "/api/v1"`)
- ✅ **Request Validation**: Optional Zod validation for request bodies (`validateServiceRequest`)
- 🏷️ **Operation Filtering**: Filter by tags, paths, methods, deprecated status, and more

### Core Features (from @cerios/openapi-to-zod)

For complete Zod schema generation features, see the [@cerios/openapi-to-zod README](../openapi-to-zod/README.md):

- ✅ **Zod v4 Compatible** with latest features
- 📝 **TypeScript Types** from `z.infer`
- 🔧 **Flexible Modes**: Strict, normal, or loose validation
- 📐 **Format Support**: uuid, email, url, date, etc.
- 🔀 **Discriminated Unions**: Automatic `z.discriminatedUnion()`
- 🔐 **readOnly/writeOnly**: Separate request/response schemas
- 📋 **Constraint Support**: multipleOf, additionalProperties, etc.
- And many more schema generation features...

## Installation

```bash
npm install @cerios/openapi-to-zod-playwright @cerios/openapi-to-zod @playwright/test zod
```

> **Note:** `@cerios/openapi-to-zod` is required as a peer dependency for shared utilities and the core functionality.

## Quick Start

### 1. Initialize Configuration

```bash
npx openapi-to-zod-playwright init
```

This will guide you through creating a configuration file:

```
? Input OpenAPI file path: openapi.yaml
? Output file path for schemas and types: tests/schemas.ts
? Output file path for client class: tests/client.ts
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
      output: 'tests/schemas.ts',
      outputClient: 'tests/client.ts',
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

This package generates up to three separate files:

### 1. Schemas (Always Generated)

- Zod validation schemas for all request/response types
- TypeScript type definitions via `z.infer`
- Located in the main `output` file

```typescript
// Generated schemas
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string()
});

export type User = z.infer<typeof userSchema>;
```

### 2. ApiClient (Always Generated - Thin Passthrough Layer)

Generated in the `outputClient` file:

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

### 3. ApiService (Optional - Validated Layer)

Generated when `outputService` is specified:

- Validates requests with Zod schemas (when `validateServiceRequest: true`)
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

## Path Prefix Stripping

The `stripPathPrefix` option removes common prefixes from API paths before generating method names and documentation. This creates cleaner, more readable method names while keeping the actual HTTP requests intact when combined with `basePath`.

### Basic Usage

```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'schemas.ts',
    outputClient: 'client.ts',
    stripPathPrefix: '/api/v1.0',  // Strip this prefix from all paths
    basePath: '/api/v1.0'          // Add it back for HTTP requests
  }]
});
```

### How It Works

**OpenAPI Spec:**
```yaml
paths:
  /api/v1.0/users:
    get:
      summary: Get all users
  /api/v1.0/posts:
    get:
      summary: Get all posts
```

**Without `stripPathPrefix`:**
```typescript
// Method names generated from full path
getApiV10Users()    // GET /api/v1.0/users
getApiV10Posts()    // GET /api/v1.0/posts
```

**With `stripPathPrefix: '/api/v1.0'`:**
```typescript
// Method names generated from stripped path (cleaner)
getUsers()    // GET /users (shown in JSDoc)
getPosts()    // GET /posts (shown in JSDoc)

// Actual HTTP requests use basePath
// GET {baseURL}/api/v1.0/users
// GET {baseURL}/api/v1.0/posts
```

### Glob Patterns

Use glob patterns to strip dynamic prefixes (e.g., version numbers):

```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'schemas.ts',
    outputClient: 'client.ts',
    // Strip any versioned API prefix using wildcards
    stripPathPrefix: '/api/v*'
  }]
});
```

**Matches:**
- `/api/v1.0/users` → `/users`
- `/api/v2.5/posts` → `/posts`
- `/api/v10.3/products` → `/products`

**Glob Pattern Syntax:**

Glob patterns support powerful matching using [minimatch](https://github.com/isaacs/minimatch):
- `*` matches any characters within a single path segment (stops at `/`)
- `**` matches any characters across multiple path segments (crosses `/` boundaries)
- `?` matches a single character
- `[abc]` matches any character in the set
- `{a,b}` matches any of the alternatives
- `!(pattern)` matches anything except the pattern

```typescript
// Examples of glob patterns:
stripPathPrefix: '/api/v*'                          // Matches /api/v1, /api/v2, /api/v10
stripPathPrefix: '/api/**/v1'                       // Matches /api/v1, /api/internal/v1, /api/public/v1
stripPathPrefix: '/api/v*.*'                        // Matches /api/v1.0, /api/v2.5
stripPathPrefix: '/api/v[0-9]'                      // Matches /api/v1, /api/v2
stripPathPrefix: '/api/{v1,v2}'                     // Matches /api/v1 or /api/v2
stripPathPrefix: '/!(internal)/**'                  // Matches any path except those starting with /internal/
```

### Normalization

`stripPathPrefix` handles various input formats:

```typescript
// All of these work the same:
stripPathPrefix: '/api/v1'      // Preferred
stripPathPrefix: 'api/v1'       // Normalized to /api/v1
stripPathPrefix: '/api/v1/'     // Trailing slash removed
```

### Common Patterns

**Pattern 1: Clean Version Prefixes**
```typescript
{
  stripPathPrefix: '/api/v1.0',
  basePath: '/api/v1.0'
}
// Paths: /api/v1.0/users → getUsers() → GET /api/v1.0/users
```

**Pattern 2: Multiple API Versions with Wildcard**
```typescript
{
  stripPathPrefix: '/api/v*',
  basePath: '/api/v2'  // Or determined at runtime
}
// All versions stripped, base path can vary
```

**Pattern 3: Versioned Paths with Dots**
```typescript
{
  stripPathPrefix: '/api/v*.*',
  basePath: '/api/v2.0'
}
// Matches: /api/v1.0, /api/v2.5, etc.
```

**Pattern 4: Organization Prefix**
```typescript
{
  stripPathPrefix: '/myorg/api',
  basePath: '/myorg/api'
}
// Paths: /myorg/api/users → getUsers() → GET /myorg/api/users
```

### Benefits

1. **Cleaner Method Names**: Generates `getUsers()` from path `/users` instead of `getApiV10Users()` from `/api/v1.0/users`
2. **Better JSDoc**: Shows `/users` instead of `/api/v1.0/users` in documentation
3. **Flexible Routing**: Strip prefix for naming, add back with `basePath` for requests
4. **Version Independence**: Use glob patterns to handle multiple API versions

## CLI Usage

### Initialize a New Config File

```bash
npx openapi-to-zod-playwright init
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

# Display help for init command
npx openapi-to-zod-playwright init --help
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
    showStats: false,
    validateServiceRequest: false, // Optional request validation
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
      outputService: 'src/generated/api-v2-service.ts',
      stripPathPrefix: '/api/v2', // Strip prefix from paths for cleaner method names
      basePath: '/api/v2', // Prepend base path to all endpoints
      mode: 'normal',
      prefix: 'v2',
      ignoreHeaders: ['Authorization', 'X-*'], // Ignore specific headers
      operationFilters: {
        includeTags: ['public'], // Only include operations with 'public' tag
        includeStatusCodes: ['2xx', '4xx'], // Only generate for success and client errors
      },
      useOperationId: false, // Use path-based method names (default)
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

#### Playwright-Specific Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `outputClient` | `string` | Optional path for client class file | `undefined` |
| `outputService` | `string` | Optional path for service class file (requires `outputClient`) | `undefined` |
| `validateServiceRequest` | `boolean` | Enable Zod validation for request bodies in service methods | `false` |
| `stripPathPrefix` | `string` | Strip prefix from paths before generating method names using glob patterns (literal string or glob pattern) | `undefined` |
| `ignoreHeaders` | `string[]` | Header patterns to ignore (supports glob patterns like `"X-*"`, `"*"`) | `undefined` |
| `basePath` | `string` | Base path to prepend to all endpoints (e.g., `"/api/v1"`) | `undefined` |
| `useOperationId` | `boolean` | Use operationId from spec for method names | `false` |
| `operationFilters` | `object` | Filter operations (see below) | `undefined` |

#### Operation Filters

| Filter | Type | Description |
|--------|------|-------------|
| `includeTags` | `string[]` | Include only operations with these tags |
| `excludeTags` | `string[]` | Exclude operations with these tags |
| `includePaths` | `string[]` | Include only these paths (supports glob patterns) |
| `excludePaths` | `string[]` | Exclude these paths (supports glob patterns) |
| `includeMethods` | `string[]` | Include only these HTTP methods |
| `excludeMethods` | `string[]` | Exclude these HTTP methods |
| `includeOperationIds` | `string[]` | Include only these operationIds |
| `excludeOperationIds` | `string[]` | Exclude these operationIds |
| `includeDeprecated` | `boolean` | Include deprecated operations |
| `includeStatusCodes` | `string[]` | Include only these status codes (e.g., `["2xx", "404"]`) |
| `excludeStatusCodes` | `string[]` | Exclude these status codes (e.g., `["5xx"]`) |

#### Core Generator Options

For schema generation options inherited from `@cerios/openapi-to-zod` (like `mode`, `includeDescriptions`, `prefix`, `suffix`, etc.), see the [@cerios/openapi-to-zod Configuration](../openapi-to-zod/README.md#configuration-options).

Common inherited options:
- `mode`: `"strict"` | `"normal"` | `"loose"` - Validation strictness
- `includeDescriptions`: Include JSDoc comments in generated schemas
- `showStats`: Include generation statistics in output
- `prefix`/`suffix`: Add prefixes/suffixes to schema names
- `defaultNullable`: Treat properties as nullable by default when not explicitly specified (default: `false`)
- `customDateTimeFormatRegex`: Custom regex pattern for date-time validation (see below)

#### Custom Date-Time Format

By default, `date-time` format fields use `z.iso.datetime()`, which requires timezone suffix (`Z`). If your API returns date-times **without the `Z` suffix** (e.g., `2026-01-07T14:30:00`), you can override this:

```typescript
import { defineConfig } from '@cerios/openapi-to-zod-playwright';

export default defineConfig({
  defaults: {
    // For date-times without Z suffix (JSON/YAML config)
    customDateTimeFormatRegex: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$',
  },
  specs: [
    {
      input: 'openapi.yaml',
      output: 'src/schemas.ts',
    },
  ],
});
```

Or using RegExp literal in TypeScript config:

```typescript
export default defineConfig({
  defaults: {
    // TypeScript config - RegExp literal (single escaping)
    customDateTimeFormatRegex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
  },
  specs: [{ input: 'openapi.yaml', output: 'src/schemas.ts', outputClient: 'src/client.ts' }],
});
```

See the [@cerios/openapi-to-zod Custom Date-Time Format documentation](../openapi-to-zod/README.md#custom-date-time-format) for more examples and patterns.

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

## Requirements

- Node.js >= 16
- @playwright/test >= 1.40.0
- Zod >= 4.0.0

## License

MIT © Ronald Veth - Cerios

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the [GitHub issues](https://github.com/CeriosTesting/openapi-to-zod/issues) page.
