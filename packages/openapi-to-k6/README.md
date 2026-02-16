# @cerios/openapi-to-k6

Generate type-safe K6 HTTP clients from OpenAPI specifications with TypeScript types.

## Features

- 🚀 **Type-safe K6 clients** - Full TypeScript support with generated interfaces
- 🔄 **Request parameter merging** - Common parameters merged with request-specific parameters
- 📝 **JSDoc generation** - Automatic documentation from OpenAPI descriptions
- 🎯 **Operation filtering** - Filter by tags, methods, paths, operationIds
- 🔧 **Flexible configuration** - CLI options or config file
- 📦 **Uses openapi-to-typescript** - Leverages existing TypeScript type generation

## Installation

```bash
npm install @cerios/openapi-to-k6
# or
pnpm add @cerios/openapi-to-k6
```

## Quick Start

### CLI Usage

```bash
# Initialize a config file
npx openapi-to-k6 init

# Generate with config file
npx openapi-to-k6

# Generate with CLI options
npx openapi-to-k6 --input openapi.yaml --output k6/api-client.ts
```

### Programmatic Usage

```typescript
import { OpenApiK6Generator } from "@cerios/openapi-to-k6";

const generator = new OpenApiK6Generator({
	input: "./openapi.yaml",
	outputClient: "./k6/api-client.ts",
	outputTypes: "./k6/api-types.ts",
	useOperationId: true,
});

generator.generate();
```

## Configuration

Create an `openapi-to-k6.config.ts` file:

```typescript
import { defineConfig } from "@cerios/openapi-to-k6";

export default defineConfig({
	defaults: {
		includeDescriptions: true,
		showStats: true,
		preferredContentTypes: ["application/json"],
	},
	specs: [
		{
			input: "openapi.yaml",
			outputClient: "k6/api-client.ts",
			outputTypes: "k6/api-types.ts",
			useOperationId: true,
			basePath: "/api/v1",
		},
	],
});
```

## Generated Client

The generated client follows the K6 HTTP patterns:

```typescript
import http from "k6/http";
import type { Params, Response } from "k6/http";

export interface ListUsersParams {
	page?: number;
	limit?: number;
}

export interface ListUsersHeaders {
	"X-Request-ID"?: string;
}

export class ApiClient {
	private readonly baseUrl: string;
	private readonly commonRequestParameters: Params;

	constructor(baseUrl: string, commonRequestParameters: Params = {}) {
		this.baseUrl = baseUrl.replace(/\/$/, "");
		this.commonRequestParameters = commonRequestParameters;
	}

	private _mergeRequestParameters(requestParams: Params, commonParams: Params): Params {
		return {
			...commonParams,
			...requestParams,
			headers: {
				...commonParams?.headers,
				...requestParams?.headers,
			},
			tags: {
				...commonParams?.tags,
				...requestParams?.tags,
			},
		};
	}

	/**
	 * @summary List all users
	 * @method GET /users
	 */
	listUsers(
		headers?: ListUsersHeaders,
		params?: ListUsersParams,
		requestParameters?: Params
	): { response: Response; data: User[] } {
		const url = this.baseUrl + `/users` + this._buildQueryString(params);
		const mergedParams = this._mergeRequestParameters(requestParameters || {}, this.commonRequestParameters);

		const response = http.request("GET", url, undefined, {
			...mergedParams,
			headers: {
				...mergedParams?.headers,
				...this._stringifyHeaders(headers || {}),
			},
		});

		const data = response.json() as User[];
		return { response, data };
	}

	// ... more methods
}
```

## Using the Generated Client in K6

```typescript
import { ApiClient } from "./api-client";
import { check, sleep } from "k6";

// Create client with base URL and common parameters
const client = new ApiClient("https://api.example.com", {
	headers: {
		Authorization: "Bearer token123",
		"Content-Type": "application/json",
	},
	tags: {
		name: "api-test",
	},
	timeout: "30s",
});

export default function () {
	// Simple GET request
	const { response, data } = client.listUsers();

	check(response, {
		"status is 200": r => r.status === 200,
		"has users": () => data.length > 0,
	});

	// GET with query parameters
	const { response: filteredResponse, data: filteredUsers } = client.listUsers(
		undefined, // headers
		{ page: 1, limit: 10 }, // query params
		{ timeout: "5s" } // request-specific K6 params
	);

	// POST with body
	const { response: createResponse, data: newUser } = client.createUser(
		{ name: "John", email: "john@example.com" }, // body
		{ timeout: "10s" } // request params
	);

	// Path parameters
	const { response: userResponse, data: user } = client.getUserById(
		"123" // userId path param
	);

	sleep(1);
}

export const options = {
	vus: 10,
	duration: "30s",
};
```

## Options

### Generator Options

| Option                  | Type       | Default                | Description                                                                                 |
| ----------------------- | ---------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| `input`                 | `string`   | required               | Path to OpenAPI specification file                                                          |
| `outputClient`          | `string`   | required               | Output path for generated K6 client                                                         |
| `outputTypes`           | `string`   | -                      | Separate file for TypeScript types                                                          |
| `useOperationId`        | `boolean`  | `false`                | Use operationId for client/service method names and operation-derived TypeScript type names |
| `basePath`              | `string`   | -                      | Base path to prepend to all endpoints                                                       |
| `stripPathPrefix`       | `string`   | -                      | Strip prefix from paths (glob support)                                                      |
| `ignoreHeaders`         | `string[]` | -                      | Header patterns to ignore                                                                   |
| `includeDescriptions`   | `boolean`  | `true`                 | Include JSDoc descriptions                                                                  |
| `showStats`             | `boolean`  | `true`                 | Show generation statistics                                                                  |
| `preferredContentTypes` | `string[]` | `["application/json"]` | Preferred content types                                                                     |

### Operation Filters

```typescript
{
  operationFilters: {
    includeTags: ['users', 'auth'],      // Only these tags
    excludeTags: ['admin'],               // Exclude these tags
    includeMethods: ['get', 'post'],      // Only these HTTP methods
    excludeMethods: ['delete'],           // Exclude these methods
    includePaths: ['/api/**'],            // Only matching paths (glob)
    excludePaths: ['/internal/**'],       // Exclude matching paths
    includeOperationIds: ['getUser'],     // Only these operationIds
    excludeOperationIds: ['deleteAll'],   // Exclude these operationIds
    excludeDeprecated: true,              // Exclude deprecated operations
  }
}
```

## Related Packages

- [@cerios/openapi-core](../openapi-core) - Shared utilities
- [@cerios/openapi-to-typescript](../openapi-to-typescript) - TypeScript type generation
- [@cerios/openapi-to-zod](../openapi-to-zod) - Zod schema generation
- [@cerios/openapi-to-zod-playwright](../openapi-to-zod-playwright) - Playwright client generation

## License

MIT
