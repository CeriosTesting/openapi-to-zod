# @cerios/openapi-to-zod

Transform OpenAPI YAML specifications into Zod v4 compliant schemas with full TypeScript support.

## Features

- ✅ **Zod v4 Compatible**: Uses latest Zod features, no deprecated methods
- 📝 **TypeScript Types**: Automatically generates TypeScript types from schemas using `z.infer`
- 🎯 **Zod Enums**: Creates Zod enum schemas from OpenAPI enums
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

### Quick Start

#### 1. Initialize Configuration

```bash
npx @cerios/openapi-to-zod init
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
  -V, --version        Output version number
  -h, --help           Display help

Commands:
  init                 Initialize a new config file

Examples:
  # Create config
  $ openapi-to-zod init

  # Generate (auto-discover config)
  $ openapi-to-zod

  # Generate with custom config path
  $ openapi-to-zod --config custom.config.ts
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
| `useDescribe` | `boolean` | Add `.describe()` calls |
| `schemaType` | `"all"` \| `"request"` \| `"response"` | Schema filtering |
| `prefix` | `string` | Prefix for schema names |
| `suffix` | `string` | Suffix for schema names |
| `stripSchemaPrefix` | `string` | Strip prefix from schema names before generating using glob patterns (e.g., `"Company.Models."` or `"*.Models."`) |
| `showStats` | `boolean` | Include generation statistics |
| `request` | `object` | Request-specific options (mode, includeDescriptions, useDescribe) |
| `response` | `object` | Response-specific options (mode, includeDescriptions, useDescribe) |
| `operationFilters` | `object` | Filter operations by tags, paths, methods, etc. (see below) |

#### Operation Filters

Filter which operations to include/exclude during schema generation. Useful for generating separate schemas for different API subsets.

| Filter | Type | Description |
|--------|------|-------------|
| `includeTags` | `string[]` | Include only operations with these tags |
| `excludeTags` | `string[]` | Exclude operations with these tags |
| `includePaths` | `string[]` | Include only these paths (supports glob patterns like `/users/**`) |
| `excludePaths` | `string[]` | Exclude these paths (supports glob patterns) |
| `includeMethods` | `string[]` | Include only these HTTP methods (`get`, `post`, etc.) |
| `excludeMethods` | `string[]` | Exclude these HTTP methods |
| `includeOperationIds` | `string[]` | Include only these operationIds (supports glob patterns) |
| `excludeOperationIds` | `string[]` | Exclude these operationIds (supports glob patterns) |
| `excludeDeprecated` | `boolean` | Exclude deprecated operations |

**Example:**
```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'schemas.ts',
    operationFilters: {
      includeTags: ['public'],        // Only public endpoints
      excludeDeprecated: true,         // Skip deprecated operations
      excludePaths: ['/internal/**']  // Exclude internal paths
    }
  }]
});
```

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

### Operation Filtering

Filter which operations are included in schema generation. This is useful when you want to generate schemas for only a subset of your API.

**Example 1: Filter by tags**
```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'public-schemas.ts',
    operationFilters: {
      includeTags: ['public', 'users']  // Only include operations tagged with 'public' or 'users'
    }
  }]
});
```

**Example 2: Filter by paths**
```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'v1-schemas.ts',
    operationFilters: {
      includePaths: ['/api/v1/**'],     // Only v1 endpoints
      excludePaths: ['/api/v1/admin/**'] // But exclude admin endpoints
    }
  }]
});
```

**Example 3: Exclude deprecated operations**
```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'current-schemas.ts',
    operationFilters: {
      excludeDeprecated: true  // Skip all deprecated operations
    }
  }]
});
```

**Filtering Logic:**
1. If no filters specified, all operations are included
2. Empty arrays are treated as "no constraint"
3. Include filters are applied first (allowlist)
4. Exclude filters are applied second (blocklist)
5. Exclude rules always win over include rules

**Statistics:** When using operation filters, generation statistics will show how many operations were filtered out.

### Request/Response Schema Separation

Generate separate schemas for requests and responses by filtering `readOnly` and `writeOnly` properties.

**Example: Request schemas (exclude readOnly)**
```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'request-schemas.ts',
    schemaType: 'request'  // Excludes readOnly properties like 'id', 'createdAt'
  }]
});
```

**Example: Response schemas (exclude writeOnly)**
```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'response-schemas.ts',
    schemaType: 'response'  // Excludes writeOnly properties like 'password'
  }]
});
```

**Example: Context-specific validation**
```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'schemas.ts',
    request: {
      mode: 'strict',           // Strict validation for incoming data
      includeDescriptions: false
    },
    response: {
      mode: 'loose',            // Flexible validation for API responses
      includeDescriptions: true
    }
  }]
});
```

**OpenAPI Spec:**
```yaml
User:
  type: object
  properties:
    id:
      type: string
      readOnly: true      # Excluded in 'request' mode
    email:
      type: string
    password:
      type: string
      writeOnly: true     # Excluded in 'response' mode
    createdAt:
      type: string
      format: date-time
      readOnly: true      # Excluded in 'request' mode
```

**Generated Request Schema** (`schemaType: 'request'`):
```typescript
export const userSchema = z.object({
  email: z.string(),
  password: z.string(),  // writeOnly included
  // id and createdAt excluded (readOnly)
});
```

**Generated Response Schema** (`schemaType: 'response'`):
```typescript
export const userSchema = z.object({
  id: z.string(),        // readOnly included
  email: z.string(),
  createdAt: z.string().datetime(),  // readOnly included
  // password excluded (writeOnly)
});
```

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

Enums are generated as Zod enums with:
- Proper string value handling
- Zod schema using `z.enum()`
- TypeScript type inference from the Zod schema

## Schema Naming

Customize schema names with prefixes and suffixes:

```typescript
// In your config file
export default defineConfig({
  specs: [
    {
      input: 'openapi.yaml',
      output: 'schemas.ts',
      prefix: 'api',  // Output: apiUserSchema, apiProductSchema
      suffix: 'dto',  // Output: userDtoSchema, productDtoSchema
    },
  ],
});
```

This is useful when:
- Working with multiple API specs in the same project
- Following specific naming conventions (DTO, Model, Entity)
- Avoiding naming conflicts with existing code

### Schema Prefix Stripping

The `stripSchemaPrefix` option removes common prefixes from schema names in your OpenAPI spec before generating Zod schemas. This is particularly useful when your OpenAPI spec uses namespaced schema names (like .NET-generated specs with "Company.Models.User").

**OpenAPI Spec with Namespaced Schemas:**
```yaml
components:
  schemas:
    Company.Models.User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        role:
          $ref: '#/components/schemas/Company.Models.UserRole'
    Company.Models.UserRole:
      type: string
      enum: [admin, user, guest]
    Company.Models.Post:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        author:
          $ref: '#/components/schemas/Company.Models.User'
```

**Without `stripSchemaPrefix`:**
```typescript
export const companyModelsUserRoleSchema = z.enum(["admin", "user", "guest"]);

export const companyModelsUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: companyModelsUserRoleSchema  // Long reference name
});

export const companyModelsPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: companyModelsUserSchema  // Long reference name
});

export type CompanyModelsUserRole = z.infer<typeof companyModelsUserRoleSchema>;
export type CompanyModelsUser = z.infer<typeof companyModelsUserSchema>;
export type CompanyModelsPost = z.infer<typeof companyModelsPostSchema>;
```

**With `stripSchemaPrefix: "Company.Models."`:**
```typescript
export const userRoleSchema = z.enum(["admin", "user", "guest"]);

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: userRoleSchema  // Clean reference
});

export const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: userSchema  // Clean reference
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type User = z.infer<typeof userSchema>;
export type Post = z.infer<typeof postSchema>;
```

#### Usage

```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'schemas.ts',
    stripSchemaPrefix: 'Company.Models.'  // Strip this exact prefix
  }]
});
```

#### Glob Patterns

Use glob patterns to strip dynamic prefixes:

```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'schemas.ts',
    // Strip any namespace prefix with wildcard
    stripSchemaPrefix: '*.Models.'
  }]
});
```

**Glob Pattern Syntax:**

Glob patterns support powerful matching using [minimatch](https://github.com/isaacs/minimatch):
- `*` matches any characters within a single segment (stops at `.`)
- `**` matches any characters across multiple segments (crosses `.` boundaries)
- `?` matches a single character
- `[abc]` matches any character in the set
- `{a,b}` matches any of the alternatives
- `!(pattern)` matches anything except the pattern

```typescript
// Examples of glob patterns:
stripSchemaPrefix: '*.Models.'                      // Matches Company.Models., App.Models.
stripSchemaPrefix: '**.Models.'                     // Matches any depth: Company.Api.Models., App.V2.Models.
stripSchemaPrefix: 'Company.{Models,Services}.'     // Matches Company.Models. or Company.Services.
stripSchemaPrefix: 'api_v[0-9]_'                   // Matches api_v1_, api_v2_, etc.
stripSchemaPrefix: 'v*.*.'                          // Matches v1.0., v2.1., etc.
stripSchemaPrefix: '!(Internal)*.'                  // Matches any prefix except those starting with Internal
```

#### Common Patterns

**Pattern 1: .NET Namespaces**
```typescript
{
  stripSchemaPrefix: 'Company.Models.'
}
// Company.Models.User → User
// Company.Models.Post → Post
```

**Pattern 2: Multiple Namespaces with Wildcard**
```typescript
{
  stripSchemaPrefix: '*.Models.'
}
// MyApp.Models.User → User
// OtherApp.Models.User → User
// Company.Models.Post → Post
```

**Pattern 3: Multiple Namespace Types**
```typescript
{
  stripSchemaPrefix: '*.{Models,Services}.'
}
// App.Models.User → User
// App.Services.UserService → UserService
```

**Pattern 4: Version Prefixes with Character Class**
```typescript
{
  stripSchemaPrefix: 'v[0-9].'
}
// v1.User → User
// v2.Product → Product
```

**Pattern 5: Versioned Prefixes with Wildcards**
```typescript
{
  stripSchemaPrefix: 'api_v*_'
}
// api_v1_User → User
// api_v2_Product → Product
// api_v10_Comment → Comment
```

#### Interaction with prefix/suffix Options

`stripSchemaPrefix` is applied **before** `prefix` and `suffix` options:

```typescript
export default defineConfig({
  specs: [{
    input: 'openapi.yaml',
    output: 'schemas.ts',
    stripSchemaPrefix: 'Company.Models.',  // Applied first
    prefix: 'api',                          // Applied second
    suffix: 'dto'                           // Applied third
  }]
});
```

**Result:**
- `Company.Models.User` → `User` → `apiUserDtoSchema`
- `Company.Models.Post` → `Post` → `apiPostDtoSchema`

#### Benefits

1. **Cleaner Schema Names**: Generates `userSchema` instead of `companyModelsUserSchema`
2. **Better Type Names**: Creates `User` type instead of `CompanyModelsUser`
3. **Shorter References**: Simpler schema references in composed types
4. **Better Code Completion**: Easier to find schemas in IDE autocomplete
5. **Flexible Pattern Matching**: Use regex for dynamic prefixes

## Generation Statistics

Statistics are **included by default** in generated files. Use `showStats: false` to disable:

```typescript
// Generation Statistics:
//   Total schemas: 42
//   Circular references: 3
//   Discriminated unions: 5
//   With constraints: 18
//   Generated at: 2025-12-07T06:21:47.634Z
```

Helpful for:
- Understanding your API complexity
- Tracking changes over time
- Debugging generation issues

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

## Public Utility Exports

Starting from **v0.7.0**, this package exports several utilities that can be used by other packages (like `@cerios/openapi-to-zod-playwright`):

### `LRUCache<K, V>`

A Least Recently Used (LRU) cache implementation for efficient caching.

```typescript
import { LRUCache } from '@cerios/openapi-to-zod';

const cache = new LRUCache<string, ParsedSpec>(50);
cache.set('spec-key', parsedSpec);
const spec = cache.get('spec-key');
```

### `toPascalCase(str: string | number): string`

Converts strings to PascalCase, handling kebab-case, snake_case, and special characters.

```typescript
import { toPascalCase } from '@cerios/openapi-to-zod';

toPascalCase('my-api-client');  // => 'MyApiClient'
toPascalCase('user_name');      // => 'UserName'
```

### `escapeJSDoc(str: string): string`

Escapes JSDoc comment terminators to prevent injection.

```typescript
import { escapeJSDoc } from '@cerios/openapi-to-zod';

escapeJSDoc('Comment with */ terminator');  // => 'Comment with *\\/ terminator'
```

### `executeBatch<T>()` and `Generator` Interface

Execute batch processing with custom generators.

```typescript
import { executeBatch, type Generator } from '@cerios/openapi-to-zod';

class MyGenerator implements Generator {
  generate(): void {
    // Your generation logic
  }
}

await executeBatch(
  specs,
  'sequential',  // or 'parallel'
  spec => new MyGenerator(spec)
);
```

### Config Validation Utilities

Shared utilities for configuration file validation:

```typescript
import {
  createTypeScriptLoader,
  formatConfigValidationError,
  type RequestResponseOptions,
  type BaseOperationFilters
} from '@cerios/openapi-to-zod';

// Create TypeScript config loader for cosmiconfig
const loader = createTypeScriptLoader();

// Format Zod validation errors
const errorMessage = formatConfigValidationError(
  zodError,
  filePath,
  configPath,
  ['Additional note 1', 'Additional note 2']
);
```

These utilities are marked with `@shared` tags in the source code and are covered by comprehensive tests.

## API Reference

### `generateZodSchemas(options: OpenApiGeneratorOptions): void`

Main function to generate schemas.

#### Options

```typescript
interface OpenApiGeneratorOptions {
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
- ✅ **Enum Generation** (4 tests) - Zod enum generation and handling
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
