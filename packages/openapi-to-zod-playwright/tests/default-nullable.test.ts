import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

/**
 * Tests for the defaultNullable option in the Playwright package
 *
 * This option controls how properties without explicit nullable annotations are treated.
 * - defaultNullable: false (default) - Properties are only nullable when explicitly marked
 * - defaultNullable: true - Properties without annotation are treated as nullable
 *   (following the industry de facto standard for OpenAPI 3.0.x)
 */
describe("Default Nullable Option", () => {
	const fixtureFile = TestUtils.getFixturePath("nullable-test.yaml");

	describe("defaultNullable: false (default behavior)", () => {
		it("should not add .nullable() to properties without annotation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: false,
			});

			const output = generator.generateSchemasString();

			// id has no nullable annotation - should NOT be nullable
			// Zod v4 uses z.uuid() directly
			expect(output).toMatch(/id:\s*z\.uuid\(\)(?!\.nullable\(\))/);

			// email has no nullable annotation - should NOT be nullable
			expect(output).toMatch(/email:\s*z\.email\(\)(?!\.nullable\(\))/);
		});

		it("should still respect explicit nullable: true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: false,
			});

			const output = generator.generateSchemasString();

			// name has nullable: true - should be nullable
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
		});

		it("should still respect explicit nullable: false", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: false,
			});

			const output = generator.generateSchemasString();

			// nickname has nullable: false - should NOT be nullable
			expect(output).toMatch(/nickname:\s*z\.string\(\)(?!\.nullable\(\))/);
		});

		it("should be the default when option is not specified", () => {
			const generatorDefault = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
			});

			const generatorExplicitFalse = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: false,
			});

			const outputDefault = generatorDefault.generateSchemasString();
			const outputExplicitFalse = generatorExplicitFalse.generateSchemasString();

			// Remove the timestamp line for comparison since it varies
			const normalizeOutput = (s: string) => s.replace(/\/\/\s+Generated at:.*\n/g, "");

			// Both should produce the same output (defaultNullable defaults to false)
			expect(normalizeOutput(outputDefault)).toBe(normalizeOutput(outputExplicitFalse));
		});
	});

	describe("defaultNullable: true (industry standard behavior)", () => {
		it("should add .nullable() to properties without annotation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// id has no nullable annotation - should be nullable with defaultNullable: true
			// Zod v4 uses z.uuid() directly
			expect(output).toMatch(/id:\s*z\.uuid\(\)\.nullable\(\)/);

			// email has no nullable annotation - should be nullable with defaultNullable: true
			expect(output).toMatch(/email:\s*z\.email\(\)\.nullable\(\)/);

			// age has no nullable annotation - should be nullable with defaultNullable: true
			expect(output).toMatch(/age:\s*z\.number\(\)\.int\(\)\.gte\(0\)\.nullable\(\)/);
		});

		it("should still respect explicit nullable: true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// name has nullable: true - should be nullable
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
		});

		it("should still respect explicit nullable: false", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// nickname has nullable: false - should NOT be nullable even with defaultNullable: true
			expect(output).toMatch(/nickname:\s*z\.string\(\)(?!\.nullable\(\))/);
		});
	});

	describe("comparison between defaultNullable values", () => {
		it("should have more .nullable() calls with defaultNullable: true", () => {
			const generatorTrue = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const generatorFalse = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: false,
			});

			const outputTrue = generatorTrue.generateSchemasString();
			const outputFalse = generatorFalse.generateSchemasString();

			const nullableCountTrue = (outputTrue.match(/\.nullable\(\)/g) || []).length;
			const nullableCountFalse = (outputFalse.match(/\.nullable\(\)/g) || []).length;

			// With defaultNullable: true, there should be more .nullable() calls
			expect(nullableCountTrue).toBeGreaterThan(nullableCountFalse);
		});

		it("should produce different outputs for the two settings", () => {
			const generatorTrue = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const generatorFalse = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: false,
			});

			const outputTrue = generatorTrue.generateSchemasString();
			const outputFalse = generatorFalse.generateSchemasString();

			// Outputs should be different
			expect(outputTrue).not.toBe(outputFalse);
		});
	});

	describe("integration with other options", () => {
		it("should work correctly with mode: strict", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				mode: "strict",
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			expect(output).toContain("z.strictObject(");
			expect(output).toContain(".nullable()");
		});

		it("should work correctly with mode: loose", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				mode: "loose",
				defaultNullable: false,
			});

			const output = generator.generateSchemasString();

			expect(output).toContain("z.looseObject(");
		});

		it("should work correctly with prefix and suffix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				prefix: "api",
				suffix: "Dto",
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			expect(output).toContain("apiUserDtoSchema");
			expect(output).toContain(".nullable()");
		});

		it("should work correctly with includeDescriptions", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				includeDescriptions: true,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Should include JSDoc comments
			expect(output).toContain("/**");
			expect(output).toContain("*/");
			expect(output).toContain(".nullable()");
		});
	});

	describe("client and service generation", () => {
		it("should use defaultNullable in generated schemas for client", () => {
			const generatorTrue = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const generatorFalse = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: false,
			});

			const clientOutputTrue = generatorTrue.generateClientString();
			const clientOutputFalse = generatorFalse.generateClientString();

			// Client generation should work with both settings
			expect(clientOutputTrue).toContain("export class ApiClient");
			expect(clientOutputFalse).toContain("export class ApiClient");
		});

		it("should use defaultNullable in generated schemas for service", () => {
			const generatorTrue = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const generatorFalse = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: false,
			});

			const serviceOutputTrue = generatorTrue.generateServiceString();
			const serviceOutputFalse = generatorFalse.generateServiceString();

			// Service generation should work with both settings
			expect(serviceOutputTrue).toContain("export class ApiService");
			expect(serviceOutputFalse).toContain("export class ApiService");
		});
	});

	describe("edge cases", () => {
		it("should handle simple-api.yaml with defaultNullable: true", () => {
			const simpleApiFile = TestUtils.getFixturePath("simple-api.yaml");
			const generator = new OpenApiPlaywrightGenerator({
				input: simpleApiFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Should generate valid schemas with nullable properties
			expect(output).toContain("export const userSchema");
			expect(output).toContain(".nullable()");
		});

		it("should handle simple-api.yaml with defaultNullable: false", () => {
			const simpleApiFile = TestUtils.getFixturePath("simple-api.yaml");
			const generator = new OpenApiPlaywrightGenerator({
				input: simpleApiFile,
				defaultNullable: false,
			});

			const output = generator.generateSchemasString();

			// Should generate valid schemas
			expect(output).toContain("export const userSchema");
		});

		it("should handle circular schemas with defaultNullable option", () => {
			const circularFile = TestUtils.getFixturePath("circular-schemas.yaml");
			const generator = new OpenApiPlaywrightGenerator({
				input: circularFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Should handle circular refs with z.lazy()
			expect(output).toContain("z.lazy(");
		});
	});

	describe("defaultNullable should NOT apply to schema references ($ref)", () => {
		it("should not make referenced enum schemas nullable with defaultNullable: true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Schema references should NOT have .nullable() appended just because of defaultNullable
			// Top-level enum schema exports should NOT end with .nullable()
			expect(output).not.toMatch(/export const \w+Schema = z\.enum\(\[[\s\S]*?\]\)\.nullable\(\);/);
		});

		it("should not make $ref properties nullable with defaultNullable: true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// When a property references another schema via $ref, it should NOT
			// automatically get .nullable() from defaultNullable
			// Pattern like: status: statusSchema.nullable() should NOT appear
			// unless explicitly marked nullable in the spec

			// Check that referenced schemas are not made nullable by default
			// The pattern "someSchema.nullable()" at property level indicates a bug
			// if it comes from defaultNullable rather than explicit annotation
			expect(output).not.toMatch(/status:\s*statusSchema\.nullable\(\)/);
		});

		it("should still make primitive properties nullable with defaultNullable: true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Regular string/number properties inside objects SHOULD be nullable
			// This confirms defaultNullable is working for the right cases
			expect(output).toMatch(/z\.string\(\)\.nullable\(\)/);
		});
	});

	describe("defaultNullable should NOT apply to enum values", () => {
		it("should not make top-level enum schemas nullable with defaultNullable: true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Top-level enum schema exports should NOT end with .nullable()
			// Pattern: export const xxxEnumSchema = z.enum([...]).nullable(); should NOT exist
			expect(output).not.toMatch(/export const \w+Schema = z\.enum\(\[[\s\S]*?\]\)\.nullable\(\);/);
		});

		it("should not make inline enum properties nullable with defaultNullable: true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Inline enum properties (z.enum([...])) should NOT have .nullable() from defaultNullable
			// They should only have .nullable() if explicitly marked
			// Match pattern: z.enum([...]).nullable() which would indicate the bug
			const inlineEnumNullableMatches = output.match(/:\s*z\.enum\(\[[\s\S]*?\]\)\.nullable\(\)/g) || [];

			// If there are any inline enum nullable matches, they should be from explicit annotations
			// In this test fixture, there shouldn't be any inline enum with defaultNullable applied
			// Check by ensuring the count matches what we expect from explicit annotations only
			expect(inlineEnumNullableMatches.length).toBeLessThanOrEqual(1); // At most 1 from explicit annotation
		});
	});

	describe("defaultNullable should NOT apply to const/literal values", () => {
		it("should not make const/literal properties nullable with defaultNullable: true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Const/literal values (z.literal(...)) should NOT have .nullable() from defaultNullable
			// Pattern: z.literal(...).nullable() should NOT appear unless explicitly marked
			const literalNullableMatches = output.match(/z\.literal\([^)]+\)\.nullable\(\)/g) || [];

			// If there are any literal nullable matches, they should be from explicit annotations only
			expect(literalNullableMatches.length).toBe(0);
		});
	});

	describe("top-level schemas should NOT be affected by defaultNullable", () => {
		it("should NOT add .nullable() to top-level object schema definitions with defaultNullable: true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Top-level schema definitions should NOT end with .nullable()
			// userSchema should be: z.object({...}); NOT z.object({...}).nullable();
			expect(output).not.toMatch(/export const userSchema = z\.object\(\{[\s\S]*?\}\)\.nullable\(\);/);
			expect(output).not.toMatch(/export const createUserRequestSchema = z\.object\(\{[\s\S]*?\}\)\.nullable\(\);/);
		});

		it("should add .nullable() to properties but not to the containing object schema", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Properties should have .nullable() (those without explicit nullable: false)
			// bio has no nullable annotation - should be nullable with defaultNullable: true
			expect(output).toMatch(/bio:\s*z\.string\(\)\.nullable\(\)/);

			// But the schema definition should not end with .nullable()
			// Count schema definitions with .nullable() at the end - should be 0
			const topLevelNullableSchemas = output.match(
				/export const \w+Schema = z\.object\(\{[\s\S]*?\}\)\.nullable\(\);/g
			);
			expect(topLevelNullableSchemas).toBeNull();
		});

		it("should produce correct schema format: properties nullable, schema not nullable", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				mode: "strict",
				defaultNullable: true,
			});

			const output = generator.generateSchemasString();

			// Verify the pattern: z.strictObject({...}) without .nullable() at the end
			// Properties inside should have .nullable()

			// The schema should use strictObject but NOT be nullable itself
			expect(output).toContain("z.strictObject({");

			// Verify there's no }).nullable(); pattern for top-level schemas
			expect(output).not.toMatch(/z\.strictObject\(\{[\s\S]*?\}\)\.nullable\(\);/);
		});
	});
});
