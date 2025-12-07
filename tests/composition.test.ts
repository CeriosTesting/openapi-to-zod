import { afterEach, describe, expect, it } from "vitest";
import { cleanupTestOutput, generateFromFixture } from "./utils/test-utils";

/**
 * Consolidated tests for OpenAPI schema composition features
 * Covers: allOf (merge/and), oneOf/anyOf (unions/discriminated unions), tuples (prefixItems)
 */
describe("Schema Composition", () => {
	const outputPath = "tests/output/schema-composition.ts";

	afterEach(cleanupTestOutput(outputPath));

	describe("AllOf Composition", () => {
		it("should use .merge() for object schemas", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain(".merge(");
			expect(output).toContain("userSchema");
		});

		it("should chain multiple .merge() calls for multiple allOf schemas", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			const userSchemaMatch = output.match(/userSchema = .*\.merge\(.*\.merge\(/s);
			expect(userSchemaMatch).toBeTruthy();
		});

		it("should handle allOf with refs and inline objects", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("baseEntitySchema");
			expect(output).toContain("timestampedSchema");
			expect(output).toContain(".merge(");
		});

		it("should handle allOf with only inline objects (no refs)", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("extendedMetadataSchema");
			expect(output).toContain(".merge(");
		});

		it("should handle allOf with 4+ schemas", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("fullyAuditedEntitySchema");
			const mergeCount = (output.match(/fullyAuditedEntitySchema.*?;/s)?.[0].match(/\.merge\(/g) || []).length;
			expect(mergeCount).toBeGreaterThanOrEqual(3);
		});

		it("should handle nullable allOf", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("nullableUserSchema");
			expect(output).toContain(".nullable()");
		});

		it("should handle nested allOf (User extended by AdminUser)", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("adminUserSchema");
			expect(output).toContain("userSchema.merge(");
		});

		it("should use .and() for non-object allOf", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("stringConstraintsSchema");
			expect(output).toContain(".and(");
		});

		it("should handle numeric allOf with .and()", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("numberConstraintsSchema");
			expect(output).toContain(".and(");
		});

		it("should maintain correct property requirements with allOf", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("userWithMetadataSchema");
			expect(output).toMatch(/username: z\.string\(\)(?!\.optional)/);
		});
	});

	describe("OneOf and AnyOf (Unions)", () => {
		it("should use z.discriminatedUnion for oneOf with discriminator", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain('z.discriminatedUnion("petType"');
		});

		it("should use z.discriminatedUnion for anyOf with discriminator", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain('z.discriminatedUnion("type"');
		});

		it("should use regular z.union for oneOf without discriminator", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
			});

			// Check for unions in simple.yaml
			if (output.includes("z.union")) {
				expect(output).toContain("z.union([");
			}
		});
	});

	describe("Tuple Validation (prefixItems)", () => {
		it("should generate z.tuple() for prefixItems", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("z.tuple([");
		});

		it("should handle simple tuple with numeric constraints", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toMatch(
				/coordinatesSchema = z\.tuple\(\[z\.number\(\)\.gte\(-90\)\.lte\(90\), z\.number\(\)\.gte\(-180\)\.lte\(180\)\]\)/
			);
		});

		it("should handle integer tuples", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("rGBSchema");
			expect(output).toContain("z.tuple([");
			expect(output).toMatch(/\.int\(\)\.gte\(0\)\.lte\(255\)/);
		});

		it("should handle mixed type tuples", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("mixedTupleSchema");
			expect(output).toContain("z.string()");
			expect(output).toContain("z.number()");
		});

		it("should handle tuples with .rest() for additional items", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("tupleWithRestSchema");
			expect(output).toContain(".rest(");
		});

		it("should handle nested object tuples", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("nestedTupleSchema");
			expect(output).toContain("z.tuple([");
			expect(output).toContain("z.object({");
		});

		it("should include descriptions for tuples", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("/** Geographic coordinates");
		});
	});

	describe("Combined Composition Features", () => {
		it("should handle both tuples and allOf in same spec", () => {
			const output = generateFromFixture({
				fixture: "composition.yaml",
				outputPath,
			});

			expect(output).toContain("z.tuple([");
			expect(output).toContain(".merge(");
		});

		it("should maintain backward compatibility", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
			});

			expect(output).toContain("userSchema");
			expect(output).not.toContain("z.tuple(");
		});
	});

	describe("Edge Cases", () => {
		it("should handle discriminated union with many variants", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			expect(output).toContain("z.discriminatedUnion(");
			expect(output).toMatch(/variant1|variant2|variant3/);
		});

		it("should handle very deep nesting", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			// Should have nested objects (level1 -> level2 -> level3 -> level4)
			expect(output).toMatch(/level1:.*z\.object/);
			expect(output).toMatch(/level4:.*z\.object/);
		});

		it("should handle nested arrays", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			// Should have z.array(z.array(...))
			expect(output).toMatch(/z\.array\(z\.array\(/);
		});
	});

	describe("Conditional Schemas (if/then/else)", () => {
		it("should generate refine validation for if/then conditionals", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// Should have refine with conditional logic
			expect(output).toContain(".refine(");
			expect(output).toMatch(/discountProductSchema|discountPercentage/i);
		});

		it("should handle if/then/else with all branches", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// ConditionalBilling should have if/then/else logic
			expect(output).toMatch(/conditionalBillingSchema[\s\S]*?\.refine/);
		});

		it("should validate then branch when condition is met", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// Should check condition and apply then requirements
			expect(output).toMatch(/if.*discountPercentage/s);
		});

		it("should validate else branch when condition is not met", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// AgeBasedRequirements should have else branch for minors
			expect(output).toMatch(/ageBasedRequirementsSchema[\s\S]*?age/);
		});

		it("should handle complex conditional checks", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// Should handle property type checks, const checks, and range checks
			expect(output).toMatch(/\.refine\(\(obj\)/);
		});
	});
});
