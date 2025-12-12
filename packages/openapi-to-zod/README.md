# @cerios/openapi-to-zod

Transform OpenAPI YAML specifications into Zod v4 compliant schemas with full TypeScript support.

## Features

- ✅ **Zod v4 Compatible**: Uses latest Zod features, no deprecated methods
- 📝 **TypeScript Types**: Automatically generates TypeScript types from schemas using `z.infer`
- 🎯 **Enums**: Creates proper TypeScript enums with PascalCase properties
- 🔧 **Flexible Modes**: Strict, normal, or loose validation
- 📐 **Format Support**: Full support for string formats (uuid, email, url, date, etc.)
- 🎨 **camelCase Schemas**: Schemas follow camelCase naming with Schema suffix
- ❓ **Optional Properties**: Uses `.optional()` for optional properties instead of `.partial()`
- 🔀 **Discriminated Unions**: Automatic `z.discriminatedUnion()` for oneOf/anyOf with discriminators
- 🔐 **readOnly/writeOnly**: Generate separate request/response schemas
- 📋 **Constraint Support**: multipleOf, additionalProperties, array constraints, min/maxProperties, and more
- 💬 **Runtime Descriptions**: Optional `.describe()` calls for better error messages
- 🏷️ **Schema Naming**: Add custom prefixes and suffixes to schema names
- 📊 **Statistics**: Optional generation statistics in output files
- ❗ **Better Errors**: Clear error messages with file paths and line numbers
- 🎭 **Tuple Validation**: OpenAPI 3.1 `prefixItems` support with `.tuple()` and `.rest()`
- 🔗 **Smart AllOf**: Uses `.merge()` for objects, `.and()` for primitives
- 🎯 **Literal Types**: `const` keyword support with `z.literal()`
- 🔢 **Exclusive Bounds**: `exclusiveMinimum`/`exclusiveMaximum` with `.gt()`/`.lt()`
- 🎨 **Unique Arrays**: `uniqueItems` validation with Set-based checking
- 📛 **Deprecation**: `@deprecated` JSDoc annotations for deprecated schemas
- 🏷️ **Metadata**: `title` and `examples` in JSDoc comments
- 🔒 **OpenAPI 3.1 Nullable**: Type array syntax `type: ["string", "null"]` support

## Installation

```bash
npm install @cerios/openapi-to-zod
```

## CLI Usage

> **Breaking Change in v2.0:** All CLI options have been removed. Use configuration files instead.

### Quick Start

#### 1. Initialize Configuration

```bash
npx @cerios/openapi-to-zod --init
```

This interactive command will:
- Prompt for your OpenAPI spec path
- Prompt for output file path
- Ask if you want to include commonly-used defaults
- Generate a config file (`openapi-to-zod.config.ts` or `.json`)

#### 2. Generate Schemas

```bash
npx @cerios/openapi-to-zod
```

The tool will auto-discover your config file and generate schemas.

### Configuration

#### TypeScript Config (Recommended)

**Minimal:**
```typescript
import { defineConfig } from '@cerios/openapi-to-zod';

export default defineConfig({
  specs: [
    {
      input: 'openapi.yaml',
      output: 'src/schemas.ts',
    },
  ],
});
```

**With Commonly-Used Defaults:**
```typescript
import { defineConfig } from '@cerios/openapi-to-zod';

export default defineConfig({
  defaults: {
    mode: 'strict',           // Strictest validation
    includeDescriptions: true, // Useful JSDoc comments
    showStats: false,          // Cleaner output
  },
  specs: [
    {
      input: 'openapi.yaml',
      output: 'src/schemas.ts',
    },
  ],
});
```

**Multi-Spec with Custom Options:**

```typescript
import { defineConfig } from '@cerios/openapi-to-zod';

export default defineConfig({
  defaults: {
    mode: 'strict',
    includeDescriptions: true,
  },
  specs: [
    {
      name: 'api-v1',
      input: 'specs/api-v1.yaml',
      output: 'src/schemas/v1.ts',
    },
    {
      name: 'api-v2',
      input: 'specs/api-v2.yaml',
      output: 'src/schemas/v2.ts',
      mode: 'normal', // Override default
      prefix: 'v2',
    },
  ],
  executionMode: 'parallel', // Process specs in parallel (default)
});
```

#### JSON Config

**openapi-to-zod.config.json:**

```json
{
  "defaults": {
    "mode": "strict",
    "includeDescriptions": true,
    "enumType": "zod",
```json
{
  "defaults": {
    "mode": "strict",
    "includeDescriptions": true
  },
  "specs": [
    {
      "input": "openapi.yaml",
      "output": "src/schemas.ts"
    }
  ]
}
```

### CLI Reference

```bash
openapi-to-zod [options]

Options:
  -c, --config <path>  Path to config file (optional if using auto-discovery)
  --init               Initialize a new config file
  -V, --version        Output version number
  -h, --help           Display help

Examples:
  # Create config
  $ openapi-to-zod --init

  # Generate (auto-discover config)
  $ openapi-to-zod

  # Generate with custom config path
  $ openapi-to-zod --config custom.config.ts
```

### Migration from v1.x

**Before (v1.x):**
```bash
openapi-to-zod -i openapi.yaml -o schemas.ts --mode strict --prefix Api
```

**After (v2.0):**
```typescript
// openapi-to-zod.config.ts
import { defineConfig } from '@cerios/openapi-to-zod';

export default defineConfig({
  specs: [
    {
      input: 'openapi.yaml',
      output: 'schemas.ts',
      mode: 'strict',
      prefix: 'Api',
    },
  ],
});
```

Then run:
```bash
openapi-to-zod
```

### Configuration Options


| Option | Type | Description |
|--------|------|-------------|
| `defaults` | `object` | Global options applied to all specs (can be overridden per-spec) |
| `specs` | `array` | Array of spec configurations (required, minimum 1) |
| `executionMode` | `"parallel"` \| `"sequential"` | How to process specs (default: `"parallel"`) |

**Per-Spec Options:**

| Spec Option | Type | Description |
|-------------|------|-------------|
| `name` | `string` | Optional identifier for logging |
| `input` | `string` | Input OpenAPI YAML file path (required) |
| `output` | `string` | Output TypeScript file path (required) |
| `mode` | `"strict"` \| `"normal"` \| `"loose"` | Validation mode |
| `includeDescriptions` | `boolean` | Include JSDoc comments |
| `enumType` | `"zod"` \| `"typescript"` | Enum generation type |
| `useDescribe` | `boolean` | Add `.describe()` calls |
| `schemaType` | `"all"` \| `"request"` \| `"response"` | Schema filtering |
| `prefix` | `string` | Prefix for schema names |
| `suffix` | `string` | Suffix for schema names |
| `showStats` | `boolean` | Include generation statistics |
| `nativeEnumType` | `"union"` \| `"enum"` | Native enum type when using TypeScript enums |
| `request` | `object` | Request-specific options (mode, typeMode, enumType, etc.) |
| `response` | `object` | Response-specific options (mode, enumType, etc.) |

### Batch Execution

**Parallel Mode** (default):
- Processes all specs concurrently
- Faster for multiple specs
- Recommended for most use cases
- Live progress shows all specs processing simultaneously

**Sequential Mode**:
- Processes specs one at a time
- Useful for resource-constrained environments
- Easier to debug issues
- Live progress shows specs processing in order

Both modes:
- Continue processing even if some specs fail
- Collect all errors and report at the end
- Exit with code 1 if any spec fails
- Show live progress updates to stderr

Example output:
```
Executing 3 spec(s) in parallel...

Processing [1/3] api-v1...
✓ Successfully generated src/schemas/v1.ts
Processing [2/3] api-v2...
✓ Successfully generated src/schemas/v2.ts
Processing [3/3] admin-api...
✗ Failed to generate src/schemas/admin.ts: Invalid YAML syntax

==================================================
Batch Execution Summary
==================================================
Total specs: 3
Successful: 2
Failed: 1

Failed specs:
  ✗ admin-api
    Error: Failed to parse OpenAPI YAML file at specs/admin.yaml: Invalid YAML syntax
==================================================
```

## Programmatic Usage

```typescript
import { generateZodSchemas } from '@cerios/openapi-to-zod';

generateZodSchemas({
  input: 'path/to/openapi.yaml',
  output: 'path/to/schemas.ts',
  mode: 'normal', // 'strict' | 'normal' | 'loose'
  includeDescriptions: true,
});
```

## Validation Modes

### Normal Mode (default)
Uses `z.object()` which allows additional properties:

```typescript
const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});
```

### Strict Mode
Uses `z.strictObject()` which rejects additional properties:

```typescript
const userSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
});
```

### Loose Mode
Uses `z.looseObject()` which explicitly allows additional properties:

```typescript
const userSchema = z.looseObject({
  id: z.uuid(),
  name: z.string(),
});
```

## Examples

### Input OpenAPI YAML

```yaml
components:
  schemas:
    UserStatusEnumOptions:
      type: string
      enum:
        - active
        - inactive
        - pending

    User:
      type: object
      required:
        - id
        - email
      properties:
        id:
          type: string
          format: uuid
          minLength: 36
          maxLength: 36
        email:
          type: string
          format: email
          maxLength: 255
        name:
          type: string
          minLength: 1
          maxLength: 100
        age:
          type: integer
          minimum: 0
          maximum: 150
        status:
          $ref: '#/components/schemas/UserStatusEnumOptions'
```

### Generated Output

```typescript
// Auto-generated by @cerios/openapi-to-zod
// Do not edit this file manually

import { z } from "zod";

// Enums
export enum UserStatusEnum {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}

// Schemas
export const userStatusEnumOptionsSchema = z.enum(UserStatusEnum);

export const userSchema = z.object({
  id: z.uuid().min(36).max(36),
  email: z.email().max(255),
  name: z.string().min(1).max(100).optional(),
  age: z.number().int().gte(0).lte(150).optional(),
  status: userStatusEnumOptionsSchema.optional(),
});

// Types
export type UserStatusEnumOptions = z.infer<typeof userStatusEnumOptionsSchema>;
export type User = z.infer<typeof userSchema>;
```

## Format Support

The generator supports all OpenAPI string formats with Zod v4:

| OpenAPI Format | Zod v4 Function |
|----------------|-----------------|
| `uuid` | `z.uuid()` |
| `email` | `z.email()` |
| `url`, `uri` | `z.url()` |
| `date` | `z.iso.date()` |
| `date-time` | `z.iso.datetime()` |
| `time` | `z.iso.time()` |
| `duration` | `z.iso.duration()` |
| `ipv4` | `z.ipv4()` |
| `ipv6` | `z.ipv6()` |
| `emoji` | `z.emoji()` |
| `base64` | `z.base64()` |
| `base64url` | `z.base64url()` |
| `nanoid` | `z.nanoid()` |
| `cuid` | `z.cuid()` |
| `cuid2` | `z.cuid2()` |
| `ulid` | `z.ulid()` |
| `cidrv4` | `z.cidrv4()` |
| `cidrv6` | `z.cidrv6()` |

## Advanced Features

### String Constraints

- `minLength` and `maxLength` are automatically applied
- `pattern` is converted to `.regex()`
- Formats with constraints are properly chained

### Number Constraints

- `minimum` becomes `.gte()`
- `maximum` becomes `.lte()`
- `integer` type uses `.int()`

### Nullable Types

OpenAPI's `nullable: true` is converted to `.nullable()`

### Schema Composition

- `allOf` → `.merge()` for objects, `.and()` for primitives
- `oneOf`, `anyOf` → `z.union()` or `z.discriminatedUnion()`
- `$ref` → Proper schema references

### Enums

Enums are generated as TypeScript enums with:
- PascalCase property names
- Original string values
- Zod schema using `z.enum()`

## Schema Naming

Customize schema names with prefixes and suffixes:

```bash
# Add API prefix
openapi-to-zod -i openapi.yaml -o schemas.ts -p api
# Output: apiUserSchema, apiProductSchema, etc.

# Add DTO suffix
openapi-to-zod -i openapi.yaml -o schemas.ts --suffix dto
# Output: userDtoSchema, productDtoSchema, etc.

# Combine both
openapi-to-zod -i openapi.yaml -o schemas.ts -p api --suffix dto
# Output: apiUserDtoSchema, apiProductDtoSchema, etc.
```

This is useful when:
- Working with multiple API specs in the same project
- Following specific naming conventions (DTO, Model, Entity)
- Avoiding naming conflicts with existing code

## Generation Statistics

Statistics are **included by default** in generated files. Use `--no-stats` to disable:

```typescript
// Generation Statistics:
//   Total schemas: 42
//   Enums: 8
//   Circular references: 3
//   Discriminated unions: 5
//   With constraints: 18
//   Generated at: 2025-12-07T06:21:47.634Z
```

Helpful for:
- Understanding your API complexity
- Tracking changes over time
- Debugging generation issues

To disable: `openapi-to-zod -i openapi.yaml -o schemas.ts --no-stats`

## OpenAPI Features Supported

### Basic Types

#### String Constraints
- `minLength` → `.min(n)`
- `maxLength` → `.max(n)`
- `pattern` → `.regex(/pattern/)`
- `format` → Specific Zod validators (see Format Support section)

#### Number Constraints
- `minimum` → `.gte(n)` (inclusive)
- `maximum` → `.lte(n)` (inclusive)
- `exclusiveMinimum` → `.gt(n)` (OpenAPI 3.0 boolean or 3.1 number)
- `exclusiveMaximum` → `.lt(n)` (OpenAPI 3.0 boolean or 3.1 number)
- `multipleOf` → `.multipleOf(n)`
- `integer` type → `.int()`

**Example:**
```yaml
Price:
  type: number
  minimum: 0
  maximum: 10000
  multipleOf: 0.01  # Enforces 2 decimal places
```

**Generated:**
```typescript
export const priceSchema = z.number().gte(0).lte(10000).multipleOf(0.01);
```

#### Exclusive Bounds (OpenAPI 3.0 & 3.1)

**OpenAPI 3.0 Style (boolean):**
```yaml
Percentage:
  type: number
  minimum: 0
  maximum: 100
  exclusiveMinimum: true
  exclusiveMaximum: true
```

**OpenAPI 3.1 Style (number):**
```yaml
Score:
  type: number
  exclusiveMinimum: 0
  exclusiveMaximum: 100
```

**Both generate:**
```typescript
export const percentageSchema = z.number().gt(0).lt(100);
```

### Array Features

#### Basic Array Constraints
- `minItems` → `.min(n)`
- `maxItems` → `.max(n)`
- `uniqueItems: true` → `.refine()` with Set-based validation

**Example:**
```yaml
UniqueTags:
  type: array
  items:
    type: string
  uniqueItems: true
  minItems: 1
  maxItems: 10
```

**Generated:**
```typescript
export const uniqueTagsSchema = z
  .array(z.string())
  .min(1)
  .max(10)
  .refine((items) => new Set(items).size === items.length, {
    message: "Array items must be unique"
  });
```

#### Tuple Validation (OpenAPI 3.1)

**OpenAPI Spec Support**: 3.1+

Use `prefixItems` for fixed-position array types (tuples):

```yaml
Coordinates:
  type: array
  description: Geographic coordinates as [latitude, longitude]
  prefixItems:
    - type: number
      minimum: -90
      maximum: 90
    - type: number
      minimum: -180
      maximum: 180
  minItems: 2
  maxItems: 2
```

**Generated:**
```typescript
export const coordinatesSchema = z.tuple([
  z.number().gte(-90).lte(90),
  z.number().gte(-180).lte(180)
]);
```

**With Rest Items:**
```yaml
CommandArgs:
  type: array
  prefixItems:
    - type: string  # Command name
    - type: string  # Action
  items:
    type: string  # Additional arguments
```

**Generated:**
```typescript
export const commandArgsSchema = z
  .tuple([z.string(), z.string()])
  .rest(z.string());
```

### Object Features

#### Property Constraints
- `required` array → Properties without `.optional()`
- `additionalProperties: false` → `.strict()` (or implicit in strict mode)
- `additionalProperties: true` → `.catchall(z.unknown())`
- `additionalProperties: {schema}` → `.catchall(schema)`
- `minProperties` → `.refine()` with property count validation
- `maxProperties` → `.refine()` with property count validation

**Example:**
```yaml
FlexibleMetadata:
  type: object
  minProperties: 1
  maxProperties: 10
  additionalProperties:
    type: string
```

**Generated:**
```typescript
export const flexibleMetadataSchema = z
  .object({})
  .catchall(z.string())
  .refine((obj) => Object.keys(obj).length >= 1 && Object.keys(obj).length <= 10, {
    message: "Object must have between 1 and 10 properties"
  });
```

### Schema Composition

#### AllOf - Smart Merging

Uses `.merge()` for objects, `.and()` for primitives:

**Object Merging:**
```yaml
User:
  allOf:
    - $ref: "#/components/schemas/BaseEntity"
    - $ref: "#/components/schemas/Timestamped"
    - type: object
      properties:
        username:
          type: string
      required:
        - username
```

**Generated:**
```typescript
export const userSchema = baseEntitySchema
  .merge(timestampedSchema)
  .merge(z.object({
    username: z.string()
  }));
```

#### OneOf / AnyOf

- `oneOf` → `z.union()` or `z.discriminatedUnion()` (if discriminator present)
- `anyOf` → `z.union()` or `z.discriminatedUnion()` (if discriminator present)

### Nullable Types

**OpenAPI 3.0 Style:**
```yaml
NullableString:
  type: string
  nullable: true
```

**OpenAPI 3.1 Style:**
```yaml
NullableString:
  type: ["string", "null"]
```

**Both generate:**
```typescript
export const nullableStringSchema = z.string().nullable();
```

### Literal Values

Use `const` for exact value matching:

```yaml
Environment:
  type: string
  const: "production"
```

**Generated:**
```typescript
export const environmentSchema = z.literal("production");
```

### Deprecation Support

Mark schemas or properties as deprecated:

```yaml
OldUser:
  type: object
  deprecated: true
  description: Legacy user schema
  properties:
    legacyId:
      type: integer
      deprecated: true
      description: Old ID format, use uuid instead
```

**Generated:**
```typescript
/** Legacy user schema @deprecated */
export const oldUserSchema = z.object({
  /** Old ID format, use uuid instead @deprecated */
  legacyId: z.number().int().optional()
});
```

### Metadata & Documentation

#### Title Field

```yaml
UserAccount:
  title: User Account
  description: Represents a user account in the system
  type: object
```

**Generated:**
```typescript
/** User Account Represents a user account in the system */
export const userAccountSchema = z.object({ /* ... */ });
```

#### Examples

```yaml
StatusCode:
  title: HTTP Status Code
  type: string
  enum: ["200", "201", "400", "404", "500"]
  examples:
    - "200"
    - "404"
    - "500"
```

**Generated:**
```typescript
/** HTTP Status Code @example "200", "404", "500" */
export const statusCodeSchema = z.enum(["200", "201", "400", "404", "500"]);
```

### Feature Matrix

| Feature | OpenAPI 3.0 | OpenAPI 3.1 | Zod Method |
|---------|-------------|-------------|------------|
| Basic types | ✅ | ✅ | `z.string()`, `z.number()`, etc. |
| String constraints | ✅ | ✅ | `.min()`, `.max()`, `.regex()` |
| Number constraints | ✅ | ✅ | `.gte()`, `.lte()`, `.int()` |
| Exclusive bounds (boolean) | ✅ | ✅ | `.gt()`, `.lt()` |
| Exclusive bounds (number) | ❌ | ✅ | `.gt()`, `.lt()` |
| multipleOf | ✅ | ✅ | `.multipleOf()` |
| Array constraints | ✅ | ✅ | `.min()`, `.max()` |
| uniqueItems | ✅ | ✅ | `.refine()` with Set |
| prefixItems (tuples) | ❌ | ✅ | `z.tuple()` |
| additionalProperties | ✅ | ✅ | `.strict()`, `.catchall()` |
| minProperties/maxProperties | ✅ | ✅ | `.refine()` |
| const | ✅ | ✅ | `z.literal()` |
| nullable (property) | ✅ | ✅ | `.nullable()` |
| nullable (type array) | ❌ | ✅ | `.nullable()` |
| allOf (objects) | ✅ | ✅ | `.merge()` |
| allOf (primitives) | ✅ | ✅ | `.and()` |
| oneOf/anyOf | ✅ | ✅ | `z.union()` |
| discriminators | ✅ | ✅ | `z.discriminatedUnion()` |
| deprecated | ✅ | ✅ | JSDoc `@deprecated` |
| title | ✅ | ✅ | JSDoc comment |
| examples | ✅ | ✅ | JSDoc `@example` |
| format | ✅ | ✅ | Specific Zod validators |
| readOnly/writeOnly | ✅ | ✅ | Schema filtering |

## Error Messages

The generator provides clear, actionable error messages:

### Invalid References
```
Error: Invalid schema 'User': Invalid reference at 'profile':
'#/components/schemas/NonExistentProfile' points to non-existent schema 'NonExistentProfile'
```

### YAML Syntax Errors
```
Error: Failed to parse OpenAPI YAML file at openapi.yaml:
Implicit keys need to be on a single line at line 12, column 9
```

All errors include:
- File path
- Line and column numbers (when available)
- Clear description of the problem
- Context about what was expected

## API Reference

### `generateZodSchemas(options: GeneratorOptions): void`

Main function to generate schemas.

#### Options

```typescript
interface GeneratorOptions {
  /**
   * Object validation mode
   * - 'strict': Uses z.strictObject() - no additional properties allowed
   * - 'normal': Uses z.object() - additional properties allowed
   * - 'loose': Uses z.looseObject() - explicitly allows additional properties
   */
  mode?: 'strict' | 'normal' | 'loose';

  /**
   * Input OpenAPI YAML file path
   */
  input: string;

  /**
   * Output TypeScript file path
   */
  output: string;

  /**
   * Whether to include descriptions as JSDoc comments
   */
  includeDescriptions?: boolean;
}
```

## Requirements

- Node.js >= 16
- Zod >= 4.0.0

## Test Coverage

Comprehensive test suite with **364 passing tests** covering:

- ✅ **Basic Schema Generation** (14 tests) - Core OpenAPI types, references, nested objects
- ✅ **Enum Generation** (10 tests) - TypeScript enums, Zod enums, PascalCase conversion
- ✅ **Circular References** (5 tests) - Self-references, mutual references, validation
- ✅ **Format Support** (9 tests) - UUID, email, URL, date-time, and 15+ other formats
- ✅ **Validation Modes** (7 tests) - Strict, normal, loose object validation
- ✅ **CLI Integration** (7 tests) - Command-line interface, options parsing
- ✅ **Integration Tests** (6 tests) - End-to-end schema generation
- ✅ **Constraint Features** (12 tests) - additionalProperties, multipleOf, array constraints
- ✅ **Additional Features** (22 tests) - minProperties/maxProperties, OpenAPI 3.1 nullable, title/examples
- ✅ **New Features** (18 tests) - const, uniqueItems, exclusive bounds, deprecated
- ✅ **Tuples & AllOf** (19 tests) - prefixItems, improved object merging
- ✅ **Request/Response Schemas** - readOnly/writeOnly filtering
- ✅ **Discriminated Unions** - oneOf/anyOf with discriminators
- ✅ **Batch Processing** - Config file loading and parallel execution

## License

MIT © Ronald Veth - Cerios

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the [GitHub issues](https://github.com/CeriosTesting/openapi-to-zod/issues) page.
