# OpenAPI to Zod Monorepo

Transform OpenAPI specifications into type-safe Zod schemas and Playwright API clients.

## Packages

### [@cerios/openapi-to-zod](./packages/openapi-to-zod)

Core schema generator - Transform OpenAPI YAML specifications into Zod v4 compliant schemas with full TypeScript support.

```bash
npm install @cerios/openapi-to-zod
```

**Features:**
- ✅ Zod v4 compatible with latest features
- 📝 Automatic TypeScript type generation
- 🎯 TypeScript/Zod enums with proper naming
- 🔧 Multiple validation modes (strict/normal/loose)
- 📐 Full format support (uuid, email, url, date, etc.)
- 🔀 Smart schema composition (allOf, oneOf, anyOf)
- 📊 Batch processing with config files

[View full documentation →](./packages/openapi-to-zod)

---

### [@cerios/openapi-to-zod-playwright](./packages/openapi-to-zod-playwright)

Playwright client generator - Generate type-safe Playwright API clients with automatic request/response validation.

```bash
npm install @cerios/openapi-to-zod-playwright @playwright/test @cerios/openapi-to-zod zod
```

**Features:**
- 🎭 Playwright `APIRequestContext` integration
- 🔒 Full type safety with Zod validation
- 🎯 Two-layer architecture (client + service)
- ✅ Automatic request/response validation
- 🧪 Testing-friendly with error methods
- 📝 Status code validation with Playwright `expect()`

[View full documentation →](./packages/openapi-to-zod-playwright)

---

## Quick Start

### Core Package

```bash
# Install
pnpm add @cerios/openapi-to-zod

# Generate schemas
npx openapi-to-zod -i openapi.yaml -o schemas.ts
```

### Playwright Package

```bash
# Install
pnpm add @cerios/openapi-to-zod-playwright @playwright/test @cerios/openapi-to-zod zod

# Generate Playwright client
npx openapi-to-zod-playwright -i openapi.yaml -o api-client.ts
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint & format
pnpm check
```

## Monorepo Structure

```
openapi-to-zod/
├── packages/
│   ├── openapi-to-zod/          # Core schema generator
│   └── openapi-to-zod-playwright/ # Playwright client generator
├── .github/workflows/            # CI/CD workflows
├── .changeset/                   # Changesets for versioning
└── package.json                  # Root workspace config
```

## Publishing

This monorepo uses [Changesets](https://github.com/changesets/changesets) for version management.

### Create a changeset

```bash
pnpm changeset
```

### Version packages

```bash
pnpm changeset version
```

### Publish to npm

```bash
pnpm release
```

Packages are independently versioned and can be released separately.

## Requirements

- Node.js >= 16
- pnpm >= 9

## License

MIT © Ronald Veth - Cerios

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the [GitHub issues](https://github.com/CeriosTesting/openapi-to-zod/issues) page.
