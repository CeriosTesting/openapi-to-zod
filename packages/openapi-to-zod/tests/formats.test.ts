import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Tests for OpenAPI format validation
 * Covers: uuid, email, url, date, date-time, ipv4, ipv6, and format combinations
 */
describe("Format Validation", () => {
	function generateOutput(fixture: string, options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath(fixture),
			...options,
		});
		return generator.generateString();
	}

	describe("String Formats", () => {
		it("should handle uuid format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.uuid()");
		});

		it("should handle email format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.email()");
		});

		it("should handle url format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.url()");
		});

		it("should handle date format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.iso.date()");
		});

		it("should handle date-time format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.iso.datetime()");
		});

		it("should handle ipv4 format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.ipv4()");
		});

		it("should handle ipv6 format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.ipv6()");
		});

		it("should handle hostname format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.string().refine((val) => /^(?=.{1,253}$)");
			expect(output).toContain("Must be a valid hostname");
		});

		it("should handle uri-reference format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.string().refine((val) => !/\\s/.test(val)");
			expect(output).toContain("Must be a valid URI reference");
		});

		it("should handle byte format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.base64()");
		});

		it("should handle binary format", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain("z.string()");
		});
	});

	describe("Format Combinations", () => {
		it("should handle string with minLength and maxLength", () => {
			const output = generateOutput("complex.yaml");

			expect(output).toMatch(/z\.string\(\)\.min\(\d+\)\.max\(\d+\)/);
		});

		it("should handle format with optional", () => {
			const output = generateOutput("formats.yaml");

			expect(output).toContain(".optional()");
		});
	});

	describe("Pattern Validation", () => {
		it("should handle basic regex patterns", () => {
			const output = generateOutput("patterns.yaml");

			expect(output).toContain(".regex(");
		});

		it("should handle pattern with escaped characters", () => {
			const output = generateOutput("patterns.yaml");

			// Should contain regex with escaped backslashes
			expect(output).toMatch(/\.regex\(\/.*\\\\./);
		});

		it("should handle complex regex patterns", () => {
			const output = generateOutput("patterns.yaml");

			// Should contain character classes and quantifiers
			expect(output).toMatch(/\.regex\(\/\^.*\[.*\].*\$\/\)/);
		});

		it("should combine pattern with minLength and maxLength", () => {
			const output = generateOutput("patterns.yaml");

			// Pattern is applied after min/max constraints
			expect(output).toMatch(/\.min\(\d+\)\.max\(\d+\)\.regex\(/);
		});

		it("should handle pattern with format", () => {
			const output = generateOutput("patterns.yaml");

			// When both pattern and format exist, pattern should be applied
			expect(output).toContain(".regex(");
		});

		it("should handle multiple patterns in one schema", () => {
			const output = generateOutput("patterns.yaml");

			// Count regex occurrences for schema with multiple patterned properties
			const regexCount = (output.match(/\.regex\(/g) || []).length;
			expect(regexCount).toBeGreaterThan(0);
		});
	});
});
