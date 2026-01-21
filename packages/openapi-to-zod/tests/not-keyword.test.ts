import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Not Keyword (OpenAPI 3.1)", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("not-keyword.yaml"),
			output: "output.ts",
			...options,
		});
		return generator.generateString();
	}

	it("should generate schema with not constraint for const", () => {
		const output = generateOutput();

		// Should have refine with not validation
		expect(output).toContain("refine");
		expect(output).toContain("!z.literal");
		expect(output).toContain("Value must not match the excluded schema");
	});

	it("should validate not empty string correctly", () => {
		const output = generateOutput();

		// Should reject empty string
		expect(output).toContain("notEmptyStringSchema");
		expect(output).toContain("refine");
	});

	it("should generate not constraint with type validation", () => {
		const output = generateOutput();

		// NotNegativeNumber should have number validation and not constraint
		expect(output).toContain("notNegativeNumberSchema");
		expect(output).toContain("z.number()");
		expect(output).toContain("refine");
	});

	it("should handle not with pattern", () => {
		const output = generateOutput();

		// NotSpecificPattern should have both pattern constraints
		expect(output).toContain("notSpecificPatternSchema");
		expect(output).toContain("regex");
	});

	it("should generate not without base type", () => {
		const output = generateOutput();

		// NotObject should use z.unknown() as base
		expect(output).toContain("notObjectSchema");
		expect(output).toContain("refine");
	});

	it("should handle not with enum exclusion", () => {
		const output = generateOutput();

		// ComplexNot should have string with minLength and enum exclusion
		expect(output).toContain("complexNotSchema");
		expect(output).toContain("value:");
		expect(output).toContain("min(1)");
	});
});
