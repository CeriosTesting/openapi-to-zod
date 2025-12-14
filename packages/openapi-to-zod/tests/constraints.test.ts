import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Consolidated tests for all OpenAPI schema constraints and validation features
 * Covers: additionalProperties, multipleOf, array constraints, minProperties/maxProperties,
 * const literals, exclusive bounds, uniqueItems, deprecated, nullable types
 */
describe("Schema Constraints", () => {
	function generateOutput(fixture: string, options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath(fixture),
			...options,
		});
		return generator.generateString();
	}

	describe("Object Constraints", () => {
		describe("additionalProperties", () => {
			it("should use .strict() when additionalProperties is false", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".strictObject(");
			});

			it("should use .strictObject in strict mode", () => {
				const output = generateOutput("constraints.yaml", { mode: "strict" });

				expect(output).toContain("z.strictObject({");
				expect(output).not.toContain(".strict()");
			});

			it("should add .catchall(z.unknown()) when additionalProperties is true", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".catchall(z.unknown())");
			});

			it("should add typed catchall when additionalProperties has a schema", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".catchall(z.string())");
			});
		});

		describe("minProperties and maxProperties", () => {
			it("should add .refine() for minProperties", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".refine((obj) => Object.keys(obj).length >= ");
			});

			it("should add .refine() for maxProperties", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".refine((obj) => Object.keys(obj).length <= ");
			});

			it("should combine minProperties and maxProperties", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".refine((obj) => Object.keys(obj).length >= ");
				expect(output).toContain(" && Object.keys(obj).length <= ");
			});

			it("should work with additionalProperties", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain("flexibleMetadataSchema");
				expect(output).toContain(".catchall(z.string())");
				expect(output).toContain(".refine(");
			});

			it("should use correct singular/plural in messages", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toMatch(/1 property|properties/);
			});
		});
	});

	describe("Number Constraints", () => {
		describe("multipleOf", () => {
			it("should add .multipleOf() for decimal numbers", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".multipleOf(0.01)");
			});

			it("should add .multipleOf() for integers", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".multipleOf(5)");
			});

			it("should combine multipleOf with min/max constraints", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toMatch(/\.gte\(\d+\)\.lte\(\d+\)\.multipleOf\(/);
			});
		});

		describe("exclusive bounds", () => {
			it("should use .gt() for exclusiveMinimum (OpenAPI 3.0 style)", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".gt(");
			});

			it("should use .lt() for exclusiveMaximum (OpenAPI 3.0 style)", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".lt(");
			});

			it("should handle mixed exclusive and inclusive bounds", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toMatch(/\.gt\(\d+\)\.lte\(\d+\)/);
			});

			it("should support OpenAPI 3.1 style exclusive bounds (number value)", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain("scoreExclusive31Schema");
				expect(output).toMatch(/\.gt\(\d+\)\.lt\(\d+\)/);
			});

			it("should combine exclusive bounds with multipleOf", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toMatch(/\.gt\(\d+\)\.lt\(\d+\)\.multipleOf\(/);
			});
		});
	});

	describe("Array Constraints", () => {
		it("should add .min() for minItems", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain(".min(1)");
		});

		it("should add .max() for maxItems", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain(".max(10)");
		});

		it("should combine min and max for arrays", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toMatch(/\.min\(\d+\)\.max\(\d+\)/);
		});

		it("should handle only maxItems without minItems", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("optionalTagsSchema");
			expect(output).toContain(".max(5)");
		});

		describe("uniqueItems", () => {
			it("should add .refine() for uniqueItems validation", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain(".refine((items) => new Set(items).size === items.length");
				expect(output).toContain('"Array items must be unique"');
			});

			it("should combine uniqueItems with other array constraints", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toMatch(/\.min\(\d+\)\.max\(\d+\)\.refine\(/);
			});

			it("should handle uniqueItems with maxItems", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain("uniqueEmailsSchema");
				expect(output).toContain(".max(");
				expect(output).toContain(".refine(");
			});

			it("should work with formatted types (uuid, email)", () => {
				const output = generateOutput("constraints.yaml");

				expect(output).toContain("uniqueIdsSchema");
				expect(output).toContain("z.uuid()");
				expect(output).toContain(".refine(");
			});
		});
	});

	describe("Literal Values (const)", () => {
		it("should generate z.literal() for const strings", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain('z.literal("production")');
		});

		it("should generate z.literal() for const numbers", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("z.literal(42)");
		});

		it("should generate z.literal() for const booleans", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("z.literal(true)");
		});

		it("should handle const in object properties", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("productWithNewFeaturesSchema");
			expect(output).toContain('z.literal("active")');
		});
	});

	describe("Nullable Types", () => {
		it("should handle OpenAPI 3.0 nullable", () => {
			const output = generateOutput("constraints.yaml");

			// Check that oldStyle property in MixedNullable has nullable
			expect(output).toContain("mixedNullableSchema");
			expect(output).toContain("oldStyle: z.string().nullable()");
		});

		it("should handle OpenAPI 3.1 type: [string, null]", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("nullableString31Schema");
			expect(output).toContain(".nullable()");
		});

		it("should handle type: [number, null] with constraints", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("nullableNumber31Schema");
			expect(output).toMatch(/\.gte\(\d+\)\.lte\(\d+\)\.nullable\(\)/);
		});

		it("should handle type: [object, null]", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("nullableObject31Schema");
			expect(output).toContain(".nullable()");
		});

		it("should handle mixed nullable styles in same schema", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("mixedNullableSchema");
			expect(output).toMatch(/oldStyle:.*\.nullable\(\)/s);
			expect(output).toMatch(/newStyle:.*\.nullable\(\)/s);
		});

		it("should handle nullable refs", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("optionalUserSchema");
			expect(output).toContain(".nullable()");
		});
	});

	describe("Deprecation Support", () => {
		it("should add @deprecated JSDoc to deprecated schemas", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("oldUserSchema");
			expect(output).toContain("@deprecated");
		});

		it("should add @deprecated to deprecated properties", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("legacyId");
			expect(output).toContain("@deprecated");
		});

		it("should show @deprecated even without includeDescriptions", () => {
			const output = generateOutput("constraints.yaml", { includeDescriptions: false });

			expect(output).toContain("@deprecated");
		});

		it("should handle deprecated with description", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("@deprecated");
			expect(output).toMatch(/Legacy.*@deprecated/s);
		});
	});

	describe("Combined Constraints", () => {
		it("should handle objects with multiple constraint types", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("productWithConstraintsSchema");
			expect(output).toContain(".min(");
			expect(output).toContain(".multipleOf(");
			expect(output).toContain(".catchall(");
		});

		it("should handle multiple new features in one schema", () => {
			const output = generateOutput("constraints.yaml");

			expect(output).toContain("productWithNewFeaturesSchema");
			expect(output).toContain("z.literal(");
			expect(output).toContain(".gt(");
			expect(output).toContain(".refine(");
		});

		it("should maintain backward compatibility", () => {
			const output = generateOutput("simple.yaml");

			expect(output).toContain("userSchema");
			expect(output).not.toContain(".refine(");
			expect(output).not.toContain("z.literal(");
		});
	});

	describe("Edge Cases", () => {
		it("should handle constraint with min equal to max", () => {
			const output = generateOutput("edge-cases.yaml");

			// Should have both min and max with same value
			expect(output).toMatch(/\.gte\(0\)\.lte\(0\)/);
		});

		it("should handle zero values in constraints", () => {
			const output = generateOutput("edge-cases.yaml");

			expect(output).toContain(".gte(0)");
		});

		it("should handle very large number constraints", () => {
			const output = generateOutput("edge-cases.yaml");

			expect(output).toMatch(/\.lte\(9999999999999\)/);
			expect(output).toMatch(/\.gte\(-9999999999999\)/);
		});

		it("should handle deeply nested nullable properties", () => {
			const output = generateOutput("edge-cases.yaml");

			// Should have multiple .nullable() calls for nested structure
			const nullableCount = (output.match(/\.nullable\(\)/g) || []).length;
			expect(nullableCount).toBeGreaterThan(2);
		});
	});

	describe("dependentRequired", () => {
		it("should generate refine validation for dependent properties", () => {
			const output = generateOutput("advanced-schema.yaml");

			// Should have refine with dependent validation
			expect(output).toContain(".refine(");
			expect(output).toMatch(/creditCard.*securityCode.*billingZip/s);
		});

		it("should handle multiple dependentRequired constraints", () => {
			const output = generateOutput("advanced-schema.yaml");

			// MultipleDependencies schema should have multiple refine calls
			expect(output).toContain("multipleDependenciesSchema");
			// Check for field1 -> field2 dependency
			expect(output).toMatch(/field1[\s\S]*?field2[\s\S]*?\.superRefine/);
			// Check for field3 -> field4 dependency
			expect(output).toMatch(/field3[\s\S]*?field4[\s\S]*?\.superRefine/);
		});

		it("should include error messages for dependent validation", () => {
			const output = generateOutput("advanced-schema.yaml");

			expect(output).toMatch(/message:[\s\S]*?present/i);
		});
	});

	describe("not keyword", () => {
		it("should generate refine validation for not constraints", () => {
			const output = generateOutput("advanced-schema.yaml");

			expect(output).toContain(".refine(");
			expect(output).toMatch(/!.*safeParse.*success/);
		});

		it("should handle not with const exclusion", () => {
			const output = generateOutput("advanced-schema.yaml");

			// NotEmptyString should exclude empty string
			expect(output).toMatch(/notEmptyStringSchema[\s\S]*?\.refine/);
		});

		it("should handle not with complex schemas", () => {
			const output = generateOutput("advanced-schema.yaml");

			// NotNegative should have not constraint
			expect(output).toMatch(/notNegativeSchema|nonNegative/i);
		});
	});
});
