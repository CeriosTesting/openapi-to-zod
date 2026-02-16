# @cerios/openapi-to-typescript

Generate TypeScript types from OpenAPI specifications.

## Features

- Generate TypeScript `type` declarations from OpenAPI schemas
- Generate TypeScript `enum`, `union`, or `const object` from OpenAPI enums
- Configurable output format options
- CLI and programmatic API
- Supports OpenAPI 3.0 and 3.1

## Installation

```bash
npm install @cerios/openapi-to-typescript
```

## Quick Start

### CLI Usage

```bash
# Initialize a config file
npx openapi-to-typescript init

# Generate types
npx openapi-to-typescript generate
```

### Configuration

Create a `openapi-to-typescript.config.ts` file:

```typescript
import { defineConfig } from "@cerios/openapi-to-typescript";

export default defineConfig({
	input: "./openapi.yaml",
	outputTypes: "./src/types.ts",

	// Output format for enums: 'enum', 'union' (default), or 'const-object'
	enumFormat: "union",
});
```

### Programmatic API

```typescript
import { TypeScriptGenerator } from "@cerios/openapi-to-typescript";

const generator = new TypeScriptGenerator({
	input: "./openapi.yaml",
	outputTypes: "./src/types.ts",
	enumFormat: "union",
});

// Generate and write to file
generator.generate();

// Or generate as string
const code = generator.generateString();
```

## Configuration Options

| Option                | Type                                  | Default   | Description                                                     |
| --------------------- | ------------------------------------- | --------- | --------------------------------------------------------------- |
| `input`               | `string`                              | -         | Path to OpenAPI specification (YAML or JSON)                    |
| `outputTypes`         | `string`                              | -         | Output file path for generated types                            |
| `enumFormat`          | `'enum' \| 'union' \| 'const-object'` | `'union'` | How to generate enums                                           |
| `includeDescriptions` | `boolean`                             | `true`    | Include JSDoc comments                                          |
| `defaultNullable`     | `boolean`                             | `false`   | Treat properties as nullable by default                         |
| `stripSchemaPrefix`   | `string \| string[]`                  | -         | Remove prefix from schema names (supports glob)                 |
| `stripPathPrefix`     | `string`                              | -         | Remove prefix from paths                                        |
| `useOperationId`      | `boolean`                             | `true`    | Use operationId for operation-derived type names when available |
| `prefix`              | `string`                              | -         | Add prefix to generated type names                              |
| `suffix`              | `string`                              | -         | Add suffix to generated type names                              |
| `operationFilters`    | `object`                              | -         | Filter operations by tags, paths, methods                       |
| `showStats`           | `boolean`                             | `true`    | Include generation statistics                                   |
| `batchSize`           | `number`                              | `10`      | Parallel processing batch size                                  |

## Output Format Examples

### Enum Format

**`union` (default):**

```typescript
export type Status = "active" | "inactive" | "pending";
```

**`enum`:**

```typescript
export enum Status {
	Active = "active",
	Inactive = "inactive",
	Pending = "pending",
}
```

**`const-object`:**

```typescript
export const Status = {
	Active: "active",
	Inactive: "inactive",
	Pending: "pending",
} as const;
export type Status = (typeof Status)[keyof typeof Status];
```

## License

MIT
