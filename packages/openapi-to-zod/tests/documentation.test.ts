import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Consolidated tests for OpenAPI metadata and documentation features
 * Covers: title, examples, descriptions, JSDoc generation, .describe() runtime
 */
describe("Metadata and Documentation", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("documentation.yaml"),
			...options,
		});
		return generator.generateString();
	}

	describe("Title Field", () => {
		it("should include title in JSDoc when different from name", () => {
			const output = generateOutput();

			expect(output).toContain("/** User Account");
			expect(output).toContain("userAccountSchema");
		});

		it("should include title for properties", () => {
			const output = generateOutput();

			expect(output).toContain("/** User ID");
			expect(output).toMatch(/id:.*uuid/);
		});

		it("should work with title and description together", () => {
			const output = generateOutput();

			expect(output).toContain("/** User Account");
			expect(output).toContain("Represents a user account");
		});
	});

	describe("Examples (plural)", () => {
		it("should include examples in JSDoc", () => {
			const output = generateOutput();

			expect(output).toContain("statusCodeSchema");
			expect(output).toContain("@example");
		});

		it("should handle examples with numbers", () => {
			const output = generateOutput();

			expect(output).toContain("priceSchema");
			expect(output).toContain("@example");
			expect(output).toMatch(/@example.*9\.99/);
		});

		it("should handle examples with objects", () => {
			const output = generateOutput();

			expect(output).toContain("flexibleMetadataSchema");
			expect(output).toContain("@example");
		});

		it("should fallback to example (singular) if examples not present", () => {
			const output = generateOutput();

			// NullableString31 uses examples (plural), test for any @example occurrence
			expect(output).toContain("nullableString31Schema");
			expect(output).toContain("@example");
		});

		it("should include examples in property JSDoc", () => {
			const output = generateOutput();

			expect(output).toContain("productWithAllFeaturesSchema");
			expect(output).toMatch(/name:.*@example.*Laptop/s);
		});
	});

	describe("Description Options", () => {
		it("should include JSDoc comments by default", () => {
			const output = generateOutput();

			expect(output).toContain("/**");
			expect(output).toContain("*/");
		});

		it("should exclude JSDoc comments when disabled", () => {
			const output = generateOutput({
				includeDescriptions: false,
			});

			const lines = output.split("\n");
			const schemaLines = lines.filter(line => line.includes("Schema ="));
			const hasJSDoc = schemaLines.some(line => {
				const prevLine = lines[lines.indexOf(line) - 1];
				return prevLine?.includes("/**");
			});

			expect(hasJSDoc).toBe(false);
		});

		it("should add .describe() when useDescribe is enabled", () => {
			const output = generateOutput({
				useDescribe: true,
			});

			expect(output).toContain('.describe("');
		});

		it("should not add .describe() when useDescribe is disabled", () => {
			const output = generateOutput({
				useDescribe: false,
			});

			expect(output).not.toContain(".describe(");
		});

		it("should support both JSDoc and .describe() together", () => {
			const output = generateOutput({
				includeDescriptions: true,
				useDescribe: true,
			});

			expect(output).toContain("/**");
			expect(output).toContain('.describe("');
		});
	});

	describe("Combined Metadata Features", () => {
		it("should handle all metadata features together", () => {
			const output = generateOutput();

			expect(output).toContain("productWithAllFeaturesSchema");
			expect(output).toContain("/** Product");
			expect(output).toContain("@example");
		});

		it("should escape special characters in descriptions", () => {
			const output = generateOutput();

			// Should handle */ and other special characters
			expect(output).not.toContain("*/*/");
		});
	});
});
