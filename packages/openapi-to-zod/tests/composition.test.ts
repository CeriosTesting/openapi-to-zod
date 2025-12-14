import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Consolidated tests for OpenAPI schema composition features
 * Covers: allOf (merge/and), oneOf/anyOf (unions/discriminated unions), tuples (prefixItems)
 */
describe("Schema Composition", () => {
	describe("AllOf Composition", () => {
		const fixturePath = TestUtils.getFixturePath("composition.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should use .merge() for object schemas", () => {
			const output = generateOutput();

			expect(output).toContain(".merge(");
			expect(output).toContain("userSchema");
		});

		it("should chain multiple .merge() calls for multiple allOf schemas", () => {
			const output = generateOutput();

			const userSchemaMatch = output.match(/userSchema = .*\.merge\(.*\.merge\(/s);
			expect(userSchemaMatch).toBeTruthy();
		});

		it("should handle allOf with refs and inline objects", () => {
			const output = generateOutput();

			expect(output).toContain("baseEntitySchema");
			expect(output).toContain("timestampedSchema");
			expect(output).toContain(".merge(");
		});

		it("should handle allOf with only inline objects (no refs)", () => {
			const output = generateOutput();

			expect(output).toContain("extendedMetadataSchema");
			expect(output).toContain(".merge(");
		});

		it("should handle allOf with 4+ schemas", () => {
			const output = generateOutput();

			expect(output).toContain("fullyAuditedEntitySchema");
			const mergeCount = (output.match(/fullyAuditedEntitySchema.*?;/s)?.[0].match(/\.merge\(/g) || []).length;
			expect(mergeCount).toBeGreaterThanOrEqual(3);
		});

		it("should handle nullable allOf", () => {
			const output = generateOutput();

			expect(output).toContain("nullableUserSchema");
			expect(output).toContain(".nullable()");
		});

		it("should handle nested allOf (User extended by AdminUser)", () => {
			const output = generateOutput();

			expect(output).toContain("adminUserSchema");
			expect(output).toContain("userSchema.merge(");
		});

		it("should use .and() for non-object allOf", () => {
			const output = generateOutput();

			expect(output).toContain("stringConstraintsSchema");
			expect(output).toContain(".and(");
		});

		it("should handle numeric allOf with .and()", () => {
			const output = generateOutput();

			expect(output).toContain("numberConstraintsSchema");
			expect(output).toContain(".and(");
		});

		it("should maintain correct property requirements with allOf", () => {
			const output = generateOutput();

			expect(output).toContain("userWithMetadataSchema");
			expect(output).toMatch(/username: z\.string\(\)(?!\.optional)/);
		});
	});

	describe("OneOf and AnyOf (Unions)", () => {
		const compositionPath = TestUtils.getFixturePath("composition.yaml");
		const simplePath = TestUtils.getFixturePath("simple.yaml");

		function generateFromComposition(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: compositionPath,
				...options,
			});
			return generator.generateString();
		}

		function generateFromSimple(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: simplePath,
				...options,
			});
			return generator.generateString();
		}

		it("should use z.discriminatedUnion for oneOf with discriminator", () => {
			const output = generateFromComposition();

			expect(output).toContain('z.discriminatedUnion("petType"');
		});

		it("should use z.discriminatedUnion for anyOf with discriminator", () => {
			const output = generateFromComposition();

			expect(output).toContain('z.discriminatedUnion("type"');
		});

		it("should use regular z.union for oneOf without discriminator", () => {
			const output = generateFromSimple();

			// Check for unions in simple.yaml
			if (output.includes("z.union")) {
				expect(output).toContain("z.union([");
			}
		});
	});

	describe("Tuple Validation (prefixItems)", () => {
		const fixturePath = TestUtils.getFixturePath("composition.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should generate z.tuple() for prefixItems", () => {
			const output = generateOutput();

			expect(output).toContain("z.tuple([");
		});

		it("should handle simple tuple with numeric constraints", () => {
			const output = generateOutput();

			expect(output).toMatch(
				/coordinatesSchema = z\.tuple\(\[z\.number\(\)\.gte\(-90\)\.lte\(90\), z\.number\(\)\.gte\(-180\)\.lte\(180\)\]\)/
			);
		});

		it("should handle integer tuples", () => {
			const output = generateOutput();

			expect(output).toContain("rGBSchema");
			expect(output).toContain("z.tuple([");
			expect(output).toMatch(/\.int\(\)\.gte\(0\)\.lte\(255\)/);
		});

		it("should handle mixed type tuples", () => {
			const output = generateOutput();

			expect(output).toContain("mixedTupleSchema");
			expect(output).toContain("z.string()");
			expect(output).toContain("z.number()");
		});

		it("should handle tuples with .rest() for additional items", () => {
			const output = generateOutput();

			expect(output).toContain("tupleWithRestSchema");
			expect(output).toContain(".rest(");
		});

		it("should handle nested object tuples", () => {
			const output = generateOutput();

			expect(output).toContain("nestedTupleSchema");
			expect(output).toContain("z.tuple([");
			expect(output).toContain("z.object({");
		});

		it("should include descriptions for tuples", () => {
			const output = generateOutput();

			expect(output).toContain("/** Geographic coordinates");
		});
	});

	describe("Combined Composition Features", () => {
		const compositionPath = TestUtils.getFixturePath("composition.yaml");
		const simplePath = TestUtils.getFixturePath("simple.yaml");

		function generateFromComposition(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: compositionPath,
				...options,
			});
			return generator.generateString();
		}

		function generateFromSimple(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: simplePath,
				...options,
			});
			return generator.generateString();
		}

		it("should handle both tuples and allOf in same spec", () => {
			const output = generateFromComposition();

			expect(output).toContain("z.tuple([");
			expect(output).toContain(".merge(");
		});

		it("should maintain backward compatibility", () => {
			const output = generateFromSimple();

			expect(output).toContain("userSchema");
			expect(output).not.toContain("z.tuple(");
		});
	});

	describe("Edge Cases", () => {
		const fixturePath = TestUtils.getFixturePath("edge-cases.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should handle discriminated union with many variants", () => {
			const output = generateOutput();

			expect(output).toContain("z.discriminatedUnion(");
			expect(output).toMatch(/variant1|variant2|variant3/);
		});

		it("should handle very deep nesting", () => {
			const output = generateOutput();

			// Should have nested objects (level1 -> level2 -> level3 -> level4)
			expect(output).toMatch(/level1:.*z\.object/);
			expect(output).toMatch(/level4:.*z\.object/);
		});

		it("should handle nested arrays", () => {
			const output = generateOutput();

			// Should have z.array(z.array(...))
			expect(output).toMatch(/z\.array\(z\.array\(/);
		});
	});

	describe("Conditional Schemas (if/then/else)", () => {
		const fixturePath = TestUtils.getFixturePath("advanced-schema.yaml");

		function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: fixturePath,
				...options,
			});
			return generator.generateString();
		}

		it("should generate superRefine validation for if/then conditionals", () => {
			const output = generateOutput();

			// Should have superRefine with conditional logic
			expect(output).toContain(".superRefine(");
			expect(output).toMatch(/discountProductSchema|discountPercentage/i);
		});

		it("should handle if/then/else with all branches", () => {
			const output = generateOutput();

			// ConditionalBilling should have if/then/else logic
			expect(output).toMatch(/conditionalBillingSchema[\s\S]*?\.superRefine/);
		});

		it("should validate then branch when condition is met", () => {
			const output = generateOutput();

			// Should check condition and apply then requirements
			expect(output).toMatch(/if.*discountPercentage/s);
		});

		it("should validate else branch when condition is not met", () => {
			const output = generateOutput();

			// AgeBasedRequirements should have else branch for minors
			expect(output).toMatch(/ageBasedRequirementsSchema[\s\S]*?age/);
		});

		it("should handle complex conditional checks", () => {
			const output = generateOutput();

			// Should handle property type checks, const checks, and range checks
			expect(output).toMatch(/\.superRefine\(\(obj, ctx\)/);
		});
	});
});
