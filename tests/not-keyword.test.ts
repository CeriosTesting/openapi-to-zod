import { afterEach, describe, expect, it } from "vitest";
import { cleanupTestOutput, generateFromFixture } from "./utils/test-utils";

describe("Not Keyword (OpenAPI 3.1)", () => {
	const outputPath = "tests/output/not-keyword.ts";

	afterEach(cleanupTestOutput(outputPath));

	it("should generate schema with not constraint for const", () => {
		const output = generateFromFixture({
			fixture: "not-keyword.yaml",
			outputPath,
		});

		// Should have refine with not validation
		expect(output).toContain("refine");
		expect(output).toContain("!z.literal");
		expect(output).toContain("Value must not match the excluded schema");
	});

	it("should validate not empty string correctly", () => {
		const output = generateFromFixture({
			fixture: "not-keyword.yaml",
			outputPath,
		});

		// Should reject empty string
		expect(output).toContain("notEmptyStringSchema");
		expect(output).toContain("refine");
	});

	it("should generate not constraint with type validation", () => {
		const output = generateFromFixture({
			fixture: "not-keyword.yaml",
			outputPath,
		});

		// NotNegativeNumber should have number validation and not constraint
		expect(output).toContain("notNegativeNumberSchema");
		expect(output).toContain("z.number()");
		expect(output).toContain("refine");
	});

	it("should handle not with pattern", () => {
		const output = generateFromFixture({
			fixture: "not-keyword.yaml",
			outputPath,
		});

		// NotSpecificPattern should have both pattern constraints
		expect(output).toContain("notSpecificPatternSchema");
		expect(output).toContain("regex");
	});

	it("should generate not without base type", () => {
		const output = generateFromFixture({
			fixture: "not-keyword.yaml",
			outputPath,
		});

		// NotObject should use z.unknown() as base
		expect(output).toContain("notObjectSchema");
		expect(output).toContain("refine");
	});

	it("should handle not with enum exclusion", () => {
		const output = generateFromFixture({
			fixture: "not-keyword.yaml",
			outputPath,
		});

		// ComplexNot should have string with minLength and enum exclusion
		expect(output).toContain("complexNotSchema");
		expect(output).toContain("value:");
		expect(output).toContain("min(1)");
	});
});
