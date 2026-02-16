import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

/**
 * Tests for the separate schemas feature (outputZodSchemas option) in Playwright generator
 *
 * This feature generates TypeScript types and Zod schemas in separate files
 * to avoid "Type instantiation is excessively deep" errors with large schemas.
 */
describe("Separate Schemas Mode", () => {
	const outputDir = TestUtils.getOutputPath("separate-schemas");
	const typesFile = join(outputDir, "types.ts");
	const schemasFile = join(outputDir, "schemas.ts");
	const clientFile = join(outputDir, "client.ts");
	const serviceFile = join(outputDir, "service.ts");

	beforeAll(() => {
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true });
		}
	});

	afterAll(() => {
		if (existsSync(outputDir)) {
			rmSync(outputDir, { recursive: true, force: true });
		}
	});

	describe("Basic functionality", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should generate separate types and schemas files", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				outputClient: clientFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			expect(existsSync(typesFile)).toBe(true);
			expect(existsSync(schemasFile)).toBe(true);
			expect(existsSync(clientFile)).toBe(true);
		});

		it("should generate TypeScript types without Zod in types file", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				outputClient: clientFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();
			const typesContent = readFileSync(typesFile, "utf-8");

			// Should have TypeScript types
			expect(typesContent).toContain("export type");

			// Should NOT have Zod
			expect(typesContent).not.toContain("import { z }");
			expect(typesContent).not.toContain("z.object");
			expect(typesContent).not.toContain("z.infer");
		});

		it("should generate Zod schemas with explicit type annotations", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				outputClient: clientFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			// Should have Zod import
			expect(schemasContent).toContain('import { z } from "zod"');

			// Should have type imports
			expect(schemasContent).toContain("import type {");

			// Should have explicit type annotations (z.ZodType<TypeName>)
			expect(schemasContent).toMatch(/z\.ZodType<\w+>/);

			// Should NOT have z.infer
			expect(schemasContent).not.toContain("z.infer<typeof");
		});
	});

	describe("Service file imports", () => {
		it("should import schemas from outputZodSchemas when specified", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				outputClient: clientFile,
				outputService: serviceFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			expect(existsSync(serviceFile)).toBe(true);
			const serviceContent = readFileSync(serviceFile, "utf-8");

			// Service should import schemas (values) from schemas file
			expect(serviceContent).toContain('from "./schemas"');
		});

		it("should import types from types file in separate mode", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				outputClient: clientFile,
				outputService: serviceFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const serviceContent = readFileSync(serviceFile, "utf-8");

			// Service should import types from types file (separate from schemas)
			expect(serviceContent).toContain('from "./types"');

			// Should have type import statement pointing to types file
			expect(serviceContent).toMatch(/import type \{[^}]+\} from "\.\/types"/);
		});

		it("should have separate imports for schemas and types", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				outputClient: clientFile,
				outputService: serviceFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const serviceContent = readFileSync(serviceFile, "utf-8");

			// Should have schema value imports (for .parse())
			const schemaValueImport = serviceContent.match(/import \{ ([^}]+) \} from "\.\/schemas"/);
			expect(schemaValueImport).toBeTruthy();
			if (schemaValueImport) {
				// All schema imports should end with "Schema"
				const schemas = schemaValueImport[1].split(",").map(s => s.trim());
				for (const schema of schemas) {
					expect(schema.endsWith("Schema")).toBe(true);
				}
			}

			// Should have type imports from types file
			const typeImport = serviceContent.match(/import type \{ ([^}]+) \} from "\.\/types"/);
			expect(typeImport).toBeTruthy();
			if (typeImport) {
				// Type imports should NOT end with "Schema"
				const types = typeImport[1].split(",").map(s => s.trim());
				for (const typeName of types) {
					expect(typeName.endsWith("Schema")).toBe(false);
				}
			}
		});

		it("should handle nested directory structure correctly", () => {
			const nestedDir = join(outputDir, "nested");
			const nestedTypesFile = join(nestedDir, "types", "api.ts");
			const nestedSchemasFile = join(nestedDir, "schemas", "api.ts");
			const nestedClientFile = join(nestedDir, "clients", "api.ts");
			const nestedServiceFile = join(nestedDir, "services", "api.ts");

			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				outputTypes: nestedTypesFile,
				outputZodSchemas: nestedSchemasFile,
				outputClient: nestedClientFile,
				outputService: nestedServiceFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const serviceContent = readFileSync(nestedServiceFile, "utf-8");

			// Service is in services/api.ts
			// Schemas are in schemas/api.ts -> ../schemas/api
			// Types are in types/api.ts -> ../types/api
			// Client is in clients/api.ts -> ../clients/api
			expect(serviceContent).toContain('from "../schemas/api"');
			expect(serviceContent).toContain('from "../types/api"');
			expect(serviceContent).toContain('from "../clients/api"');
		});

		it("should import from single file in combined mode", () => {
			const combinedDir = join(outputDir, "combined-service");
			const combinedFile = join(combinedDir, "api.ts");
			const combinedClientFile = join(combinedDir, "client.ts");
			const combinedServiceFile = join(combinedDir, "service.ts");

			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				outputTypes: combinedFile,
				// No outputZodSchemas - combined mode
				outputClient: combinedClientFile,
				outputService: combinedServiceFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const serviceContent = readFileSync(combinedServiceFile, "utf-8");

			// In combined mode, both schemas and types come from the same file
			expect(serviceContent).toContain('from "./api"');

			// Should NOT have separate imports from types file
			expect(serviceContent).not.toMatch(/from "\.\/types"/);
		});
	});

	describe("Backward compatibility", () => {
		it("should work normally without outputZodSchemas option", () => {
			const combinedOutput = join(outputDir, "combined.ts");
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				outputTypes: combinedOutput,
				// No outputZodSchemas - should behave like before
				outputClient: clientFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			expect(existsSync(combinedOutput)).toBe(true);
			const content = readFileSync(combinedOutput, "utf-8");

			// Should have both schemas and z.infer types (combined mode)
			expect(content).toContain('import { z } from "zod"');
			expect(content).toContain("z.infer<typeof");
		});
	});

	describe("TypeScript compilation", () => {
		it("should generate valid TypeScript in separate files", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				outputClient: clientFile,
				outputService: serviceFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			// Verify all files are generated
			expect(existsSync(typesFile)).toBe(true);
			expect(existsSync(schemasFile)).toBe(true);
			expect(existsSync(clientFile)).toBe(true);
			expect(existsSync(serviceFile)).toBe(true);

			// Verify types file has TypeScript types
			const typesContent = readFileSync(typesFile, "utf-8");
			expect(typesContent).toContain("export type");
			expect(typesContent).not.toContain("import { z }");

			// Verify schemas file uses z.ZodType and imports types
			const schemasContent = readFileSync(schemasFile, "utf-8");
			expect(schemasContent).toContain('import { z } from "zod"');
			expect(schemasContent).toContain("import type {");
			expect(schemasContent).toMatch(/z\.ZodType<\w+>/);
			// Should not have z.infer type exports for component schemas
			expect(schemasContent).not.toMatch(/export type \w+ = z\.infer<typeof/);

			// Service file should exist and import from schemas
			const serviceContent = readFileSync(serviceFile, "utf-8");
			expect(serviceContent).toContain("./schemas");
		});
	});
});
