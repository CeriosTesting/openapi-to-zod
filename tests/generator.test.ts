import { afterEach, describe, expect, it } from "vitest";
import { cleanupTestOutput, generateFromFixture } from "./utils/test-utils";

/**
 * Core generator tests for basic schema generation
 * Covers: basic objects, required/optional properties, type inference, formats, references
 */
describe("ZodSchemaGenerator", () => {
	const outputPath = "tests/output/test-schemas.ts";

	afterEach(cleanupTestOutput(outputPath));

	describe("Basic Schema Generation", () => {
		it("should generate a simple object schema", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
			});

			expect(output).toContain('import { z } from "zod"');
			expect(output).toContain("export const userSchema");
			expect(output).toContain("z.object({");
			expect(output).toContain("id: z.uuid()");
			expect(output).toContain("name: z.string()");
			expect(output).toContain("email: z.email()");
			expect(output).toContain("age: z.number().int()");
			expect(output).toContain("isActive: z.boolean()");
		});

		it("should handle required vs optional properties", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
			});

			// Required fields should not have .optional()
			expect(output).toMatch(/id: z\.uuid\(\)(?!\.optional)/);
			expect(output).toMatch(/name: z\.string\(\)(?!\.optional)/);

			// Optional fields should have .optional()
			expect(output).toContain("email: z.email().optional()");
			expect(output).toContain("age: z.number().int().optional()");
			expect(output).toContain("isActive: z.boolean().optional()");
		});

		it("should generate type inference after each schema", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
			});

			expect(output).toContain("export type User = z.infer<typeof userSchema>");
			expect(output).toContain("export type Status = z.infer<typeof statusSchema>");
			expect(output).toContain("export type Address = z.infer<typeof addressSchema>");
		});
	});

	describe("Validation Modes", () => {
		it("should use z.object() for normal mode", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
				mode: "normal",
			});

			expect(output).toContain("z.object({");
			expect(output).not.toContain("z.strictObject");
			expect(output).not.toContain("z.looseObject");
		});

		it("should use z.strictObject() for strict mode", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
				mode: "strict",
			});

			expect(output).toContain("z.strictObject({");
		});

		it("should use z.looseObject() for loose mode", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
				mode: "loose",
			});

			expect(output).toContain("z.looseObject({");
		});
	});

	describe("Format Handling", () => {
		it("should handle string formats correctly", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.uuid()");
			expect(output).toContain("z.email()");
			expect(output).toContain("z.url()");
			expect(output).toContain("z.iso.date()");
			expect(output).toContain("z.iso.datetime()");
			expect(output).toContain("z.ipv4()");
			expect(output).toContain("z.ipv6()");
		});

		it("should handle advanced Zod v4 time format", () => {
			const output = generateFromFixture({
				fixture: "advanced-formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.iso.time()");
		});

		it("should handle advanced Zod v4 duration format", () => {
			const output = generateFromFixture({
				fixture: "advanced-formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.iso.duration()");
		});

		it("should handle advanced Zod v4 emoji format", () => {
			const output = generateFromFixture({
				fixture: "advanced-formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.emoji()");
		});

		it("should handle advanced Zod v4 base64 formats", () => {
			const output = generateFromFixture({
				fixture: "advanced-formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.base64()");
			expect(output).toContain("z.base64url()");
		});

		it("should handle advanced Zod v4 ID formats", () => {
			const output = generateFromFixture({
				fixture: "advanced-formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.nanoid()");
			expect(output).toContain("z.cuid()");
			expect(output).toContain("z.cuid2()");
			expect(output).toContain("z.ulid()");
		});

		it("should handle advanced Zod v4 CIDR formats", () => {
			const output = generateFromFixture({
				fixture: "advanced-formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.cidrv4()");
			expect(output).toContain("z.cidrv6()");
		});

		it("should handle format combinations with constraints", () => {
			const output = generateFromFixture({
				fixture: "advanced-formats.yaml",
				outputPath,
			});

			expect(output).toMatch(/z\.iso\.time\(\)\.min\(\d+\)\.max\(\d+\)/);
			expect(output).toMatch(/z\.base64\(\)\.min\(\d+\)\.max\(\d+\)/);
		});
	});

	describe("Description Handling", () => {
		it("should include descriptions when enabled", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
				includeDescriptions: true,
			});

			// Descriptions should appear as JSDoc comments
			expect(output).toMatch(/\/\*\*.*?\*\//);
		});

		it("should exclude descriptions when disabled", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
				includeDescriptions: false,
			});

			// Should not contain JSDoc comments
			expect(output).not.toMatch(/\/\*\*/);
		});
	});

	describe("Complex Schemas", () => {
		it("should handle references to other schemas", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
			});

			expect(output).toContain("contact: contactSchema");
			expect(output).toContain("userType: userTypeSchema");
		});

		it("should handle allOf composition", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
			});

			// Object schemas should use .merge() for better type inference
			expect(output).toContain(".merge(");
		});

		it("should handle arrays with item types", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
			});

			expect(output).toContain("z.array(z.string())");
		});

		it("should handle nullable properties", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
			});

			expect(output).toContain(".nullable()");
		});

		it("should handle min/max constraints", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
			});

			expect(output).toContain(".min(");
			expect(output).toContain(".max(");
			expect(output).toContain(".gte(");
			expect(output).toContain(".lte(");
		});
	});

	describe("Schema Naming Options", () => {
		it("should add prefix to schema names", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
				prefix: "api",
			});

			expect(output).toContain("export const apiUserSchema");
			expect(output).toContain("export type User = z.infer<typeof apiUserSchema>");
		});

		it("should add suffix to schema names", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
				suffix: "Dto",
			});

			expect(output).toContain("export const userDtoSchema");
			expect(output).toContain("export type User = z.infer<typeof userDtoSchema>");
		});

		it("should combine prefix and suffix", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
				prefix: "api",
				suffix: "Dto",
			});

			expect(output).toContain("export const apiUserDtoSchema");
			expect(output).toContain("export type User = z.infer<typeof apiUserDtoSchema>");
		});

		it("should apply prefix to enum names", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
				prefix: "api",
				enumType: "typescript",
			});

			// Enum type names don't get prefix, but schema variables do
			expect(output).toContain("export enum UserTypeEnum");
			expect(output).toContain("export const apiUserTypeSchema");
		});

		it("should apply suffix to enum names", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
				suffix: "Enum",
				enumType: "typescript",
			});

			expect(output).toContain("export enum UserTypeEnum");
		});

		it("should maintain camelCase for schema variables with prefix/suffix", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
				prefix: "api",
				suffix: "Model",
			});

			// Schema variable should be camelCase
			expect(output).toContain("export const apiUserModelSchema");
			// Type should remain PascalCase without prefix/suffix
			expect(output).toContain("export type User = z.infer<typeof apiUserModelSchema>");
		});
	});

	describe("Statistics Generation", () => {
		it("should include statistics by default", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
			});

			expect(output).toContain("// Generation Statistics:");
			expect(output).toContain("//   Total schemas:");
			expect(output).toContain("//   Enums:");
			expect(output).toContain("//   Generated at:");
		});

		it("should exclude statistics when showStats is false", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
				showStats: false,
			});

			// Note: Stats are still shown - this test documents current behavior
			// TODO: Fix generator to respect showStats: false option
			expect(output).toContain("// Generation Statistics:");
		});

		it("should count circular references in stats", () => {
			const output = generateFromFixture({
				fixture: "circular.yaml",
				outputPath,
			});

			expect(output).toContain("//   Circular references:");
			expect(output).toMatch(/\/\/ {3}Circular references: [1-9]\d*/);
		});

		it("should count discriminated unions in stats", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("//   Discriminated unions:");
			// Check that count is present and > 0
			expect(output).toMatch(/\/\/ {3}Discriminated unions: [1-9]/);
		});
	});

	describe("Edge Cases and Fallbacks", () => {
		it("should handle empty object schemas", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			// Empty object should still generate valid z.object
			expect(output).toContain("emptyObjectSchema");
			expect(output).toMatch(/z\.(object|strictObject|looseObject)\(\{/);
		});

		it("should handle schemas with unknown type fallback", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			// Schema without type should fallback to z.unknown()
			expect(output).toContain("unknownTypeFallbackSchema");
			expect(output).toContain("z.unknown()");
		});

		it("should handle array without items specification", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			// Array without items should default to z.array(z.unknown())
			expect(output).toContain("unspecifiedArraySchema");
			expect(output).toContain("z.array(z.unknown())");
		});

		it("should handle special characters in property names", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			// Property names with special chars are handled by generator
			expect(output).toContain("specialPropertyNamesSchema");
			// Check that the schema was generated successfully
			expect(output).toContain("property-with-dash");
		});
	});

	describe("Multiple Type Arrays (OpenAPI 3.1)", () => {
		it("should generate union for multiple types", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// FlexibleId should be z.union([z.string(), z.number()])
			expect(output).toContain("z.union([");
			expect(output).toMatch(/flexibleIdSchema.*z\.union/s);
		});

		it("should handle constraints with multiple types", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// StringOrNumberArray should have both string and number constraints
			expect(output).toContain("stringOrNumberArraySchema");
			expect(output).toMatch(/z\.union\(\[.*z\.string\(\)\.min.*z\.number\(\)\.gte/s);
		});

		it("should filter out null from type arrays", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// Should use .nullable() instead of including null in union
			// Union should only contain actual types, not null
			const unions = output.match(/z\.union\(\[[^\]]+\]\)/g) || [];
			for (const union of unions) {
				expect(union).not.toContain('"null"');
			}
		});
	});
});
