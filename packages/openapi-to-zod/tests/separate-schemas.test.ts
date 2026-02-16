import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

import { TestUtils } from "./utils/test-utils";

/**
 * Tests for the separate schemas feature (outputZodSchemas option)
 *
 * This feature generates TypeScript types and Zod schemas in separate files
 * to avoid "Type instantiation is excessively deep" errors with large schemas.
 */
describe("Separate Schemas Mode", () => {
	const outputDir = TestUtils.getOutputPath("separate-schemas");
	const typesFile = join(outputDir, "types.ts");
	const schemasFile = join(outputDir, "schemas.ts");

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
		const fixtureFile = TestUtils.getFixturePath("simple.yaml");

		it("should generate separate types and schemas files", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			expect(existsSync(typesFile)).toBe(true);
			expect(existsSync(schemasFile)).toBe(true);
		});

		it("should generate TypeScript types without Zod in types file", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
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
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
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

			// Should NOT have z.infer (types come from separate file)
			expect(schemasContent).not.toContain("z.infer<typeof");
		});

		it("should calculate correct relative import path for same directory", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			// Should have correct relative import for same directory
			expect(schemasContent).toContain('from "./types"');
		});
	});

	describe("Nested directory structure", () => {
		const nestedTypesFile = join(outputDir, "types", "api.ts");
		const nestedSchemasFile = join(outputDir, "schemas", "api.ts");

		it("should handle different directories for types and schemas", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: nestedTypesFile,
				outputZodSchemas: nestedSchemasFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			expect(existsSync(nestedTypesFile)).toBe(true);
			expect(existsSync(nestedSchemasFile)).toBe(true);

			const schemasContent = readFileSync(nestedSchemasFile, "utf-8");
			// Should have correct relative import path
			expect(schemasContent).toContain('from "../types/api"');
		});
	});

	describe("Options passthrough", () => {
		it("should apply mode option to generated schemas", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "strict",
				showStats: false,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			expect(schemasContent).toContain("z.strictObject");
		});

		it("should apply includeDescriptions option", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				includeDescriptions: true,
				showStats: false,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");
			const typesContent = readFileSync(typesFile, "utf-8");

			// Both should have JSDoc comments
			expect(typesContent).toMatch(/\/\*\*/);
			expect(schemasContent).toMatch(/\/\*\*/);
		});

		it("should apply prefix and suffix options", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				prefix: "api",
				suffix: "dto",
				showStats: false,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			// Schema names should have prefix and suffix
			expect(schemasContent).toMatch(/api\w+DtoSchema/i);
		});
	});

	describe("TypeScript compilation", () => {
		it("should compile both files successfully", { timeout: 30_000 }, () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			// Create a tsconfig for this test
			const tsconfigPath = join(outputDir, "tsconfig.json");
			const tsconfig = {
				compilerOptions: {
					target: "ES2020",
					module: "commonjs",
					strict: true,
					esModuleInterop: true,
					skipLibCheck: true,
					noEmit: true,
					baseUrl: ".",
					paths: {
						zod: ["../../node_modules/zod"],
					},
				},
				include: ["*.ts"],
			};
			writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

			// Should compile without errors
			try {
				execSync(`npx tsc --project ${tsconfigPath}`, {
					cwd: outputDir,
					stdio: "pipe",
					encoding: "utf-8",
				});
			} catch (error: unknown) {
				const err = error as { stdout?: string; stderr?: string; message?: string };
				const output = err.stdout || err.stderr || err.message;
				throw new Error(`TypeScript compilation failed:\n${output}`);
			}
		});
	});

	describe("Backward compatibility", () => {
		it("should work normally without outputZodSchemas option", () => {
			const combinedOutput = join(outputDir, "combined.ts");
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: combinedOutput,
				// No outputZodSchemas - should behave like before
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			expect(existsSync(combinedOutput)).toBe(true);
			const content = readFileSync(combinedOutput, "utf-8");

			// Should have both schemas and z.infer types
			expect(content).toContain('import { z } from "zod"');
			expect(content).toContain("z.infer<typeof");
		});
	});

	describe("Enum handling", () => {
		it("should handle enums with proper type annotation", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			// Should have ZodEnum type annotation for enums (if any exist in the spec)
			// or ZodType for regular schemas
			expect(schemasContent).toMatch(/z\.Zod(Enum|Type)</);
		});
	});

	describe("Enum format variations with z.ZodType", () => {
		// Use root fixtures folder for enums.yaml
		const enumFixture = TestUtils.getCoreFixturePath("basic", "enums.yaml");
		const enumTypesFile = join(outputDir, "enum-types.ts");
		const enumSchemasFile = join(outputDir, "enum-schemas.ts");

		it("should compile with enumFormat='const-object' (default)", { timeout: 30_000 }, () => {
			const generator = new OpenApiGenerator({
				input: enumFixture,
				outputTypes: enumTypesFile,
				outputZodSchemas: enumSchemasFile,
				mode: "normal",
				showStats: false,
				enumFormat: "const-object",
			});

			generator.generate();

			const typesContent = readFileSync(enumTypesFile, "utf-8");
			const schemasContent = readFileSync(enumSchemasFile, "utf-8");

			// Types file should have const object pattern
			expect(typesContent).toContain("as const");

			// Schemas should have z.ZodType annotations
			expect(schemasContent).toMatch(/z\.ZodType<StringEnum>/);
			expect(schemasContent).toContain('from "./enum-types"');

			// Should NOT have z.infer exports
			expect(schemasContent).not.toContain("z.infer<typeof");

			// Compile both files
			const tsconfigPath = join(outputDir, "tsconfig-enum-const.json");
			const tsconfig = {
				compilerOptions: {
					target: "ES2020",
					module: "commonjs",
					strict: true,
					esModuleInterop: true,
					skipLibCheck: true,
					noEmit: true,
					baseUrl: ".",
					paths: { zod: ["../../node_modules/zod"] },
				},
				include: ["enum-types.ts", "enum-schemas.ts"],
			};
			writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

			try {
				execSync(`npx tsc --project ${tsconfigPath}`, {
					cwd: outputDir,
					stdio: "pipe",
					encoding: "utf-8",
				});
			} catch (error: unknown) {
				const err = error as { stdout?: string; stderr?: string; message?: string };
				throw new Error(
					`TypeScript compilation failed with enumFormat='const-object':\n${err.stdout || err.stderr || err.message}`
				);
			}
		});

		it("should compile with enumFormat='union'", { timeout: 30_000 }, () => {
			const generator = new OpenApiGenerator({
				input: enumFixture,
				outputTypes: enumTypesFile,
				outputZodSchemas: enumSchemasFile,
				mode: "normal",
				showStats: false,
				enumFormat: "union",
			});

			generator.generate();

			const typesContent = readFileSync(enumTypesFile, "utf-8");
			const schemasContent = readFileSync(enumSchemasFile, "utf-8");

			// Types file should have union type declaration
			expect(typesContent).toMatch(/export type \w+ = "[^"]+"/);

			// Schemas should have z.ZodType annotations
			expect(schemasContent).toMatch(/z\.ZodType<StringEnum>/);

			// Should NOT have z.infer exports
			expect(schemasContent).not.toContain("z.infer<typeof");

			// Compile both files
			const tsconfigPath = join(outputDir, "tsconfig-enum-union.json");
			const tsconfig = {
				compilerOptions: {
					target: "ES2020",
					module: "commonjs",
					strict: true,
					esModuleInterop: true,
					skipLibCheck: true,
					noEmit: true,
					baseUrl: ".",
					paths: { zod: ["../../node_modules/zod"] },
				},
				include: ["enum-types.ts", "enum-schemas.ts"],
			};
			writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

			try {
				execSync(`npx tsc --project ${tsconfigPath}`, {
					cwd: outputDir,
					stdio: "pipe",
					encoding: "utf-8",
				});
			} catch (error: unknown) {
				const err = error as { stdout?: string; stderr?: string; message?: string };
				throw new Error(
					`TypeScript compilation failed with enumFormat='union':\n${err.stdout || err.stderr || err.message}`
				);
			}
		});

		it("should handle numeric enums correctly", () => {
			const generator = new OpenApiGenerator({
				input: enumFixture,
				outputTypes: enumTypesFile,
				outputZodSchemas: enumSchemasFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();
			const schemasContent = readFileSync(enumSchemasFile, "utf-8");

			// Numeric enums should have z.ZodType annotation
			expect(schemasContent).toMatch(/z\.ZodType<NumericEnum>/);
		});

		it("should handle mixed enums (union/literal types) correctly", () => {
			const generator = new OpenApiGenerator({
				input: enumFixture,
				outputTypes: enumTypesFile,
				outputZodSchemas: enumSchemasFile,
				mode: "normal",
				showStats: false,
			});

			generator.generate();
			const schemasContent = readFileSync(enumSchemasFile, "utf-8");

			// Mixed enums should have z.ZodType annotation
			expect(schemasContent).toMatch(/z\.ZodType<MixedEnum>/);
		});
	});

	describe("Type assertion threshold", () => {
		const fixtureFile = TestUtils.getFixturePath("simple.yaml");

		it("should use annotation syntax by default (threshold = 0)", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				showStats: false,
				typeAssertionThreshold: 0,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			// Should use annotation syntax ": z.ZodType<X> ="
			expect(schemasContent).toMatch(/export const \w+Schema: z\.ZodType<\w+> =/);

			// Should NOT use double assertion syntax "as unknown as z.ZodType<X>"
			expect(schemasContent).not.toMatch(/as unknown as z\.ZodType</);
		});

		it("should use annotation syntax when threshold not set", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				showStats: false,
				// No typeAssertionThreshold - should default to 0
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			// Should use annotation syntax ": z.ZodType<X> ="
			expect(schemasContent).toMatch(/export const \w+Schema: z\.ZodType<\w+> =/);

			// Should NOT use double assertion syntax "as unknown as z.ZodType<X>"
			expect(schemasContent).not.toMatch(/as unknown as z\.ZodType</);
		});

		it("should use assertion syntax when schema complexity meets threshold", () => {
			// Use constraints.yaml which has complex nested schemas
			const complexFixture = TestUtils.getFixturePath("constraints.yaml");

			const generator = new OpenApiGenerator({
				input: complexFixture,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				showStats: false,
				// Very low threshold to force assertion syntax
				typeAssertionThreshold: 1,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			// With very low threshold, should use double assertion syntax for most schemas
			// At least one schema should use double assertion syntax
			expect(schemasContent).toMatch(/as unknown as z\.ZodType</);
		});

		it("should use annotation for simple schemas even with low threshold", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				showStats: false,
				// Very high threshold - simple schemas shouldn't meet it
				typeAssertionThreshold: 1000,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			// High threshold means annotation syntax for all schemas
			expect(schemasContent).toMatch(/export const \w+Schema: z\.ZodType<\w+> =/);
			expect(schemasContent).not.toMatch(/as unknown as z\.ZodType</);
		});

		it("should mix annotation and assertion based on individual schema complexity", () => {
			// Create a fixture with both simple and complex schemas
			const mixedFixtureDir = join(outputDir, "fixtures");
			if (!existsSync(mixedFixtureDir)) {
				mkdirSync(mixedFixtureDir, { recursive: true });
			}
			const mixedFixture = join(mixedFixtureDir, "mixed-complexity.yaml");
			writeFileSync(
				mixedFixture,
				`
openapi: "3.0.0"
info:
  title: Mixed Complexity API
  version: "1.0.0"
paths: {}
components:
  schemas:
    SimpleSchema:
      type: object
      properties:
        id:
          type: string
    ComplexSchema:
      type: object
      properties:
        level1:
          type: object
          properties:
            level2:
              type: object
              properties:
                level3:
                  type: object
                  properties:
                    level4:
                      type: object
                      properties:
                        level5:
                          type: object
                          properties:
                            a:
                              type: string
                            b:
                              type: string
                            c:
                              type: string
                            d:
                              type: string
                            e:
                              type: string
`
			);

			const generator = new OpenApiGenerator({
				input: mixedFixture,
				outputTypes: typesFile,
				outputZodSchemas: schemasFile,
				mode: "normal",
				showStats: false,
				// Medium threshold
				typeAssertionThreshold: 30,
			});

			generator.generate();
			const schemasContent = readFileSync(schemasFile, "utf-8");

			// Simple schema should use annotation
			expect(schemasContent).toMatch(/simpleSchemaSchema: z\.ZodType<SimpleSchema> =/);

			// Complex schema should use double assertion - use multiline match since schema spans many lines
			expect(schemasContent).toMatch(/complexSchemaSchema = [\s\S]*? as unknown as z\.ZodType<ComplexSchema>/);
		});
	});
});
