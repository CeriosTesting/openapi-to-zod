import { afterEach, describe, expect, it } from "vitest";
import { cleanupTestOutput, generateFromFixture } from "./utils/test-utils";

/**
 * Tests for OpenAPI format validation
 * Covers: uuid, email, url, date, date-time, ipv4, ipv6, and format combinations
 */
describe("Format Validation", () => {
	const outputPath = "tests/output/formats.ts";

	afterEach(cleanupTestOutput(outputPath));

	describe("String Formats", () => {
		it("should handle uuid format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.uuid()");
		});

		it("should handle email format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.email()");
		});

		it("should handle url format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.url()");
		});

		it("should handle date format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.iso.date()");
		});

		it("should handle date-time format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.iso.datetime()");
		});

		it("should handle ipv4 format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.ipv4()");
		});

		it("should handle ipv6 format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.ipv6()");
		});

		it("should handle hostname format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.string().refine((val) => /^(?=.{1,253}$)");
			expect(output).toContain("Must be a valid hostname");
		});

		it("should handle uri-reference format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.string().refine((val) => !/\\s/.test(val)");
			expect(output).toContain("Must be a valid URI reference");
		});

		it("should handle byte format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.base64()");
		});

		it("should handle binary format", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain("z.string()");
		});
	});

	describe("Format Combinations", () => {
		it("should handle string with minLength and maxLength", () => {
			const output = generateFromFixture({
				fixture: "complex.yaml",
				outputPath,
			});

			expect(output).toMatch(/z\.string\(\)\.min\(\d+\)\.max\(\d+\)/);
		});

		it("should handle format with optional", () => {
			const output = generateFromFixture({
				fixture: "formats.yaml",
				outputPath,
			});

			expect(output).toContain(".optional()");
		});
	});

	describe("Pattern Validation", () => {
		it("should handle basic regex patterns", () => {
			const output = generateFromFixture({
				fixture: "patterns.yaml",
				outputPath,
			});

			expect(output).toContain(".regex(");
		});

		it("should handle pattern with escaped characters", () => {
			const output = generateFromFixture({
				fixture: "patterns.yaml",
				outputPath,
			});

			// Should contain regex with escaped backslashes
			expect(output).toMatch(/\.regex\(\/.*\\\\./);
		});

		it("should handle complex regex patterns", () => {
			const output = generateFromFixture({
				fixture: "patterns.yaml",
				outputPath,
			});

			// Should contain character classes and quantifiers
			expect(output).toMatch(/\.regex\(\/\^.*\[.*\].*\$\/\)/);
		});

		it("should combine pattern with minLength and maxLength", () => {
			const output = generateFromFixture({
				fixture: "patterns.yaml",
				outputPath,
			});

			// Pattern is applied after min/max constraints
			expect(output).toMatch(/\.min\(\d+\)\.max\(\d+\)\.regex\(/);
		});

		it("should handle pattern with format", () => {
			const output = generateFromFixture({
				fixture: "patterns.yaml",
				outputPath,
			});

			// When both pattern and format exist, pattern should be applied
			expect(output).toContain(".regex(");
		});

		it("should handle multiple patterns in one schema", () => {
			const output = generateFromFixture({
				fixture: "patterns.yaml",
				outputPath,
			});

			// Count regex occurrences for schema with multiple patterned properties
			const regexCount = (output.match(/\.regex\(/g) || []).length;
			expect(regexCount).toBeGreaterThan(0);
		});
	});
});
