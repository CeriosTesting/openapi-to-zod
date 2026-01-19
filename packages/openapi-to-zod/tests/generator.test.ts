import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Core generator tests for basic schema generation
 * Covers: basic objects, required/optional properties, type inference, formats, references
 */
describe("OpenApiGenerator", () => {
	describe("Basic Schema Generation", () => {
		const fixturePath = TestUtils.getFixturePath("simple.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should generate a simple object schema", () => {
			const output = generateOutput();

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
			const output = generateOutput();

			// Required fields should not have .optional()
			expect(output).toMatch(/id: z\.uuid\(\)(?!\.optional)/);
			expect(output).toMatch(/name: z\.string\(\)(?!\.optional)/);

			// Optional fields should have .optional()
			expect(output).toContain("email: z.email().optional()");
			expect(output).toContain("age: z.number().int().optional()");
			expect(output).toContain("isActive: z.boolean().optional()");
		});

		it("should generate type inference after each schema", () => {
			const output = generateOutput();

			expect(output).toContain("export type User = z.infer<typeof userSchema>");
			expect(output).toContain("export type Status = z.infer<typeof statusSchema>");
			expect(output).toContain("export type Address = z.infer<typeof addressSchema>");
		});
	});

	describe("Validation Modes", () => {
		const fixturePath = TestUtils.getFixturePath("simple.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should use z.object() for normal mode", () => {
			const output = generateOutput({ mode: "normal" });

			expect(output).toContain("z.object({");
			expect(output).not.toContain("z.strictObject");
			expect(output).not.toContain("z.looseObject");
		});

		it("should use z.strictObject() for strict mode", () => {
			const output = generateOutput({ mode: "strict" });

			expect(output).toContain("z.strictObject({");
		});

		it("should use z.looseObject() for loose mode", () => {
			const output = generateOutput({ mode: "loose" });

			expect(output).toContain("z.looseObject({");
		});
	});

	describe("Format Handling", () => {
		const formatsPath = TestUtils.getFixturePath("formats.yaml");
		const advancedFormatsPath = TestUtils.getFixturePath("advanced-formats.yaml");

		function generateFromFormats(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: formatsPath,
				...options,
			});
			return generator.generateString();
		}

		function generateFromAdvancedFormats(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: advancedFormatsPath,
				...options,
			});
			return generator.generateString();
		}

		it("should handle string formats correctly", () => {
			const output = generateFromFormats();

			expect(output).toContain("z.uuid()");
			expect(output).toContain("z.email()");
			expect(output).toContain("z.url()");
			expect(output).toContain("z.iso.date()");
			expect(output).toContain("z.iso.datetime()");
			expect(output).toContain("z.ipv4()");
			expect(output).toContain("z.ipv6()");
		});

		it("should handle advanced Zod v4 time format", () => {
			const output = generateFromAdvancedFormats();

			expect(output).toContain("z.iso.time()");
		});

		it("should handle advanced Zod v4 duration format", () => {
			const output = generateFromAdvancedFormats();

			// Now uses enhanced duration validation with regex
			expect(output).toMatch(/duration.*refine.*ISO 8601 duration/s);
		});
		it("should handle advanced Zod v4 emoji format", () => {
			const output = generateFromAdvancedFormats();

			expect(output).toContain("z.emoji()");
		});

		it("should handle advanced Zod v4 base64 formats", () => {
			const output = generateFromAdvancedFormats();

			expect(output).toContain("z.base64()");
			expect(output).toContain("z.base64url()");
		});

		it("should handle advanced Zod v4 ID formats", () => {
			const output = generateFromAdvancedFormats();

			expect(output).toContain("z.nanoid()");
			expect(output).toContain("z.cuid()");
			expect(output).toContain("z.cuid2()");
			expect(output).toContain("z.ulid()");
		});

		it("should handle advanced Zod v4 CIDR formats", () => {
			const output = generateFromAdvancedFormats();

			expect(output).toContain("z.cidrv4()");
			expect(output).toContain("z.cidrv6()");
		});

		it("should handle format combinations with constraints", () => {
			const output = generateFromAdvancedFormats();

			expect(output).toMatch(/z\.iso\.time\(\)\.min\(\d+\)\.max\(\d+\)/);
			expect(output).toMatch(/z\.base64\(\)\.min\(\d+\)\.max\(\d+\)/);
		});
	});

	describe("Description Handling", () => {
		const fixturePath = TestUtils.getFixturePath("simple.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should include descriptions when enabled", () => {
			const output = generateOutput({ includeDescriptions: true });

			// Descriptions should appear as JSDoc comments
			expect(output).toMatch(/\/\*\*.*?\*\//);
		});

		it("should exclude descriptions when disabled", () => {
			const output = generateOutput({ includeDescriptions: false });

			// Should not contain JSDoc comments
			expect(output).not.toMatch(/\/\*\*/);
		});
	});

	describe("Complex Schemas", () => {
		const fixturePath = TestUtils.getFixturePath("complex.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should handle references to other schemas", () => {
			const output = generateOutput();

			expect(output).toContain("contact: contactSchema");
			expect(output).toContain("userType: userTypeSchema");
		});

		it("should handle allOf composition", () => {
			const output = generateOutput();

			// Object schemas should use .extend() (Zod v4 - .merge() is deprecated)
			expect(output).toContain(".extend(");
		});

		it("should handle arrays with item types", () => {
			const output = generateOutput();

			expect(output).toContain("z.array(z.string())");
		});

		it("should handle nullable properties", () => {
			const output = generateOutput();

			expect(output).toContain(".nullable()");
		});

		it("should handle min/max constraints", () => {
			const output = generateOutput();

			expect(output).toContain(".min(");
			expect(output).toContain(".max(");
			expect(output).toContain(".gte(");
			expect(output).toContain(".lte(");
		});
	});

	describe("Schema Naming Options", () => {
		const simplePath = TestUtils.getFixturePath("simple.yaml");

		function generateFromSimple(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: simplePath,
				...options,
			});
			return generator.generateString();
		}

		it("should add prefix to schema names", () => {
			const output = generateFromSimple({ prefix: "api" });

			expect(output).toContain("export const apiUserSchema");
			expect(output).toContain("export type User = z.infer<typeof apiUserSchema>");
		});

		it("should add suffix to schema names", () => {
			const output = generateFromSimple({ suffix: "Dto" });

			expect(output).toContain("export const userDtoSchema");
			expect(output).toContain("export type User = z.infer<typeof userDtoSchema>");
		});

		it("should combine prefix and suffix", () => {
			const output = generateFromSimple({ prefix: "api", suffix: "Dto" });

			expect(output).toContain("export const apiUserDtoSchema");
			expect(output).toContain("export type User = z.infer<typeof apiUserDtoSchema>");
		});

		it("should maintain camelCase for schema variables with prefix/suffix", () => {
			const output = generateFromSimple({ prefix: "api", suffix: "Model" });

			// Schema variable should be camelCase
			expect(output).toContain("export const apiUserModelSchema");
			// Type should remain PascalCase without prefix/suffix
			expect(output).toContain("export type User = z.infer<typeof apiUserModelSchema>");
		});
	});

	describe("Statistics Generation", () => {
		const complexPath = TestUtils.getFixturePath("complex.yaml");
		const circularPath = TestUtils.getFixturePath("circular.yaml");
		const compositionPath = TestUtils.getFixturePath("composition.yaml");

		function generateFromComplex(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: complexPath,
				...options,
			});
			return generator.generateString();
		}

		function generateFromCircular(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: circularPath,
				...options,
			});
			return generator.generateString();
		}

		function generateFromComposition(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: compositionPath,
				...options,
			});
			return generator.generateString();
		}

		it("should include statistics by default", () => {
			const output = generateFromComplex();

			expect(output).toContain("// Generation Statistics:");
			expect(output).toContain("//   Total schemas:");
			expect(output).toContain("//   Generated at:");
		});

		it("should exclude statistics when showStats is false", () => {
			const output = generateFromComplex({ showStats: false });

			expect(output).not.toContain("// Generation Statistics:");
		});

		it("should count circular references in stats", () => {
			const output = generateFromCircular();

			expect(output).toContain("//   Circular references:");
			expect(output).toMatch(/\/\/ {3}Circular references: [1-9]\d*/);
		});

		it("should count discriminated unions in stats", () => {
			const output = generateFromComposition();

			expect(output).toContain("//   Discriminated unions:");
			// Check that count is present and > 0
			expect(output).toMatch(/\/\/ {3}Discriminated unions: [1-9]/);
		});
	});

	describe("Edge Cases and Fallbacks", () => {
		const fixturePath = TestUtils.getFixturePath("edge-cases.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should handle empty object schemas", () => {
			const output = generateOutput();

			// Empty object should still generate valid z.object
			expect(output).toContain("emptyObjectSchema");
			expect(output).toMatch(/z\.(object|strictObject|looseObject)\(\{/);
		});

		it("should handle schemas with unknown type fallback", () => {
			const output = generateOutput();

			// Schema without type should fallback to z.unknown()
			expect(output).toContain("unknownTypeFallbackSchema");
			expect(output).toContain("z.unknown()");
		});

		it("should handle array without items specification", () => {
			const output = generateOutput();

			// Array without items should default to z.array(z.unknown())
			expect(output).toContain("unspecifiedArraySchema");
			expect(output).toContain("z.array(z.unknown())");
		});

		it("should handle special characters in property names", () => {
			const output = generateOutput();

			// Property names with special chars are handled by generator
			expect(output).toContain("specialPropertyNamesSchema");
			// Check that the schema was generated successfully
			expect(output).toContain("property-with-dash");
		});
	});

	describe("Multiple Type Arrays (OpenAPI 3.1)", () => {
		const fixturePath = TestUtils.getFixturePath("advanced-schema.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should generate union for multiple types", () => {
			const output = generateOutput();

			// FlexibleId should be z.union([z.string(), z.number()])
			expect(output).toContain("z.union([");
			expect(output).toMatch(/flexibleIdSchema.*z\.union/s);
		});

		it("should handle constraints with multiple types", () => {
			const output = generateOutput();

			// StringOrNumberArray should have both string and number constraints
			expect(output).toContain("stringOrNumberArraySchema");
			expect(output).toMatch(/z\.union\(\[.*z\.string\(\)\.min.*z\.number\(\)\.gte/s);
		});

		it("should filter out null from type arrays", () => {
			const output = generateOutput();

			// Should use .nullable() instead of including null in union
			// Union should only contain actual types, not null
			const unions = output.match(/z\.union\(\[[^\]]+\]\)/g) || [];
			for (const union of unions) {
				expect(union).not.toContain('"null"');
			}
		});
	});

	describe("JSON Format Support", () => {
		it("should parse JSON files identically to YAML files", () => {
			const yamlGenerator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				showStats: false,
			});
			const jsonGenerator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.json"),
				showStats: false,
			});

			const yamlOutput = yamlGenerator.generateString();
			const jsonOutput = jsonGenerator.generateString();

			// Both outputs should be identical
			expect(jsonOutput).toBe(yamlOutput);
		});

		it("should handle complex JSON specs with nested objects", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("type-mode.json"),
			});

			const output = generator.generateString();

			expect(output).toContain("export const userSchema");
			expect(output).toContain("export const createUserRequestSchema");
			expect(output).toContain("export const userStatusSchema");
			expect(output).toContain("export const userProfileSchema");
		});

		it("should throw error for invalid JSON files", () => {
			expect(() => {
				new OpenApiGenerator({
					input: TestUtils.getFixturePath("invalid-json.txt"),
				});
			}).toThrow(/Failed to parse OpenAPI specification/);
		});
	});
});
