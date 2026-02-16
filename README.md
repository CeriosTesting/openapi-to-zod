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
- 🎯 Zod enums with proper handling
- 🔧 Multiple validation modes (strict/normal/loose)
- 📐 Full format support (uuid, email, url, date, etc.)
- 🔀 Smart schema composition (allOf, oneOf, anyOf)
- 📊 Batch processing with config files

[View full documentation →](./packages/openapi-to-zod)

---

### [@cerios/openapi-to-zod-playwright](./packages/openapi-to-zod-playwright)

Playwright client generator - Generate type-safe Playwright API clients with automatic request/response validation.

```bash
npm install @cerios/openapi-to-zod-playwright @playwright/test zod
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

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Lint & format
npm run check
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
npm run changeset
```

Packages are independently versioned and can be released separately.

## Requirements

- Node.js >= 16
- npm >= 7

## License

MIT © Ronald Veth - Cerios

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the [GitHub issues](https://github.com/CeriosTesting/openapi-to-zod/issues) page.
