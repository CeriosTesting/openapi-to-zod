import { afterEach, describe, expect, it } from "vitest";
import { cleanupTestOutput, generateFromFixture } from "./utils/test-utils";

/**
 * Consolidated tests for all OpenAPI schema constraints and validation features
 * Covers: additionalProperties, multipleOf, array constraints, minProperties/maxProperties,
 * const literals, exclusive bounds, uniqueItems, deprecated, nullable types
 */
describe("Schema Constraints", () => {
	const outputPath = "tests/output/schema-constraints.ts";

	afterEach(cleanupTestOutput(outputPath));

	describe("Object Constraints", () => {
		describe("additionalProperties", () => {
			it("should use .strict() when additionalProperties is false", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".strictObject(");
			});

			it("should use .strictObject in strict mode", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
					mode: "strict",
				});

				expect(output).toContain("z.strictObject({");
				expect(output).not.toContain(".strict()");
			});

			it("should add .catchall(z.unknown()) when additionalProperties is true", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".catchall(z.unknown())");
			});

			it("should add typed catchall when additionalProperties has a schema", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".catchall(z.string())");
			});
		});

		describe("minProperties and maxProperties", () => {
			it("should add .refine() for minProperties", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".refine((obj) => Object.keys(obj).length >= ");
			});

			it("should add .refine() for maxProperties", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".refine((obj) => Object.keys(obj).length <= ");
			});

			it("should combine minProperties and maxProperties", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".refine((obj) => Object.keys(obj).length >= ");
				expect(output).toContain(" && Object.keys(obj).length <= ");
			});

			it("should work with additionalProperties", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain("flexibleMetadataSchema");
				expect(output).toContain(".catchall(z.string())");
				expect(output).toContain(".refine(");
			});

			it("should use correct singular/plural in messages", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toMatch(/1 property|properties/);
			});
		});
	});

	describe("Number Constraints", () => {
		describe("multipleOf", () => {
			it("should add .multipleOf() for decimal numbers", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".multipleOf(0.01)");
			});

			it("should add .multipleOf() for integers", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".multipleOf(5)");
			});

			it("should combine multipleOf with min/max constraints", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toMatch(/\.gte\(\d+\)\.lte\(\d+\)\.multipleOf\(/);
			});
		});

		describe("exclusive bounds", () => {
			it("should use .gt() for exclusiveMinimum (OpenAPI 3.0 style)", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".gt(");
			});

			it("should use .lt() for exclusiveMaximum (OpenAPI 3.0 style)", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".lt(");
			});

			it("should handle mixed exclusive and inclusive bounds", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toMatch(/\.gt\(\d+\)\.lte\(\d+\)/);
			});

			it("should support OpenAPI 3.1 style exclusive bounds (number value)", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain("scoreExclusive31Schema");
				expect(output).toMatch(/\.gt\(\d+\)\.lt\(\d+\)/);
			});

			it("should combine exclusive bounds with multipleOf", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toMatch(/\.gt\(\d+\)\.lt\(\d+\)\.multipleOf\(/);
			});
		});
	});

	describe("Array Constraints", () => {
		it("should add .min() for minItems", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain(".min(1)");
		});

		it("should add .max() for maxItems", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain(".max(10)");
		});

		it("should combine min and max for arrays", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toMatch(/\.min\(\d+\)\.max\(\d+\)/);
		});

		it("should handle only maxItems without minItems", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("optionalTagsSchema");
			expect(output).toContain(".max(5)");
		});

		describe("uniqueItems", () => {
			it("should add .refine() for uniqueItems validation", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain(".refine((items) => new Set(items).size === items.length");
				expect(output).toContain('"Array items must be unique"');
			});

			it("should combine uniqueItems with other array constraints", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toMatch(/\.min\(\d+\)\.max\(\d+\)\.refine\(/);
			});

			it("should handle uniqueItems with maxItems", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain("uniqueEmailsSchema");
				expect(output).toContain(".max(");
				expect(output).toContain(".refine(");
			});

			it("should work with formatted types (uuid, email)", () => {
				const output = generateFromFixture({
					fixture: "constraints.yaml",
					outputPath,
				});

				expect(output).toContain("uniqueIdsSchema");
				expect(output).toContain("z.uuid()");
				expect(output).toContain(".refine(");
			});
		});
	});

	describe("Literal Values (const)", () => {
		it("should generate z.literal() for const strings", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain('z.literal("production")');
		});

		it("should generate z.literal() for const numbers", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("z.literal(42)");
		});

		it("should generate z.literal() for const booleans", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("z.literal(true)");
		});

		it("should handle const in object properties", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("productWithNewFeaturesSchema");
			expect(output).toContain('z.literal("active")');
		});
	});

	describe("Nullable Types", () => {
		it("should handle OpenAPI 3.0 nullable", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			// Check that oldStyle property in MixedNullable has nullable
			expect(output).toContain("mixedNullableSchema");
			expect(output).toContain("oldStyle: z.string().nullable()");
		});

		it("should handle OpenAPI 3.1 type: [string, null]", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("nullableString31Schema");
			expect(output).toContain(".nullable()");
		});

		it("should handle type: [number, null] with constraints", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("nullableNumber31Schema");
			expect(output).toMatch(/\.gte\(\d+\)\.lte\(\d+\)\.nullable\(\)/);
		});

		it("should handle type: [object, null]", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("nullableObject31Schema");
			expect(output).toContain(".nullable()");
		});

		it("should handle mixed nullable styles in same schema", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("mixedNullableSchema");
			expect(output).toMatch(/oldStyle:.*\.nullable\(\)/s);
			expect(output).toMatch(/newStyle:.*\.nullable\(\)/s);
		});

		it("should handle nullable refs", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("optionalUserSchema");
			expect(output).toContain(".nullable()");
		});
	});

	describe("Deprecation Support", () => {
		it("should add @deprecated JSDoc to deprecated schemas", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("oldUserSchema");
			expect(output).toContain("@deprecated");
		});

		it("should add @deprecated to deprecated properties", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("legacyId");
			expect(output).toContain("@deprecated");
		});

		it("should show @deprecated even without includeDescriptions", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
				includeDescriptions: false,
			});

			expect(output).toContain("@deprecated");
		});

		it("should handle deprecated with description", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("@deprecated");
			expect(output).toMatch(/Legacy.*@deprecated/s);
		});
	});

	describe("Combined Constraints", () => {
		it("should handle objects with multiple constraint types", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("productWithConstraintsSchema");
			expect(output).toContain(".min(");
			expect(output).toContain(".multipleOf(");
			expect(output).toContain(".catchall(");
		});

		it("should handle multiple new features in one schema", () => {
			const output = generateFromFixture({
				fixture: "constraints.yaml",
				outputPath,
			});

			expect(output).toContain("productWithNewFeaturesSchema");
			expect(output).toContain("z.literal(");
			expect(output).toContain(".gt(");
			expect(output).toContain(".refine(");
		});

		it("should maintain backward compatibility", () => {
			const output = generateFromFixture({
				fixture: "simple.yaml",
				outputPath,
			});

			expect(output).toContain("userSchema");
			expect(output).not.toContain(".refine(");
			expect(output).not.toContain("z.literal(");
		});
	});

	describe("Edge Cases", () => {
		it("should handle constraint with min equal to max", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			// Should have both min and max with same value
			expect(output).toMatch(/\.gte\(0\)\.lte\(0\)/);
		});

		it("should handle zero values in constraints", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			expect(output).toContain(".gte(0)");
		});

		it("should handle very large number constraints", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			expect(output).toMatch(/\.lte\(9999999999999\)/);
			expect(output).toMatch(/\.gte\(-9999999999999\)/);
		});

		it("should handle deeply nested nullable properties", () => {
			const output = generateFromFixture({
				fixture: "edge-cases.yaml",
				outputPath,
			});

			// Should have multiple .nullable() calls for nested structure
			const nullableCount = (output.match(/\.nullable\(\)/g) || []).length;
			expect(nullableCount).toBeGreaterThan(2);
		});
	});

	describe("dependentRequired", () => {
		it("should generate refine validation for dependent properties", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// Should have refine with dependent validation
			expect(output).toContain(".refine(");
			expect(output).toMatch(/creditCard.*securityCode.*billingZip/s);
		});

		it("should handle multiple dependentRequired constraints", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// MultipleDependencies schema should have multiple refine calls
			const schema = output.match(
				/export const multipleDependenciesSchema = z\.object\(\{[\s\S]*?\}\)(?:\.refine[\s\S]*?)*;/
			)?.[0];
			expect(schema).toBeTruthy();
			const refineCount = (schema?.match(/\.refine\(/g) || []).length;
			expect(refineCount).toBeGreaterThanOrEqual(2);
		});

		it("should include error messages for dependent validation", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			expect(output).toMatch(/message:.*present/i);
		});
	});

	describe("not keyword", () => {
		it("should generate refine validation for not constraints", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			expect(output).toContain(".refine(");
			expect(output).toMatch(/!.*safeParse.*success/);
		});

		it("should handle not with const exclusion", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// NotEmptyString should exclude empty string
			expect(output).toMatch(/notEmptyStringSchema[\s\S]*?\.refine/);
		});

		it("should handle not with complex schemas", () => {
			const output = generateFromFixture({
				fixture: "advanced-schema.yaml",
				outputPath,
			});

			// NotNegative should have not constraint
			expect(output).toMatch(/notNegativeSchema|nonNegative/i);
		});
	});
});
