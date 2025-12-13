import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Tests for string generation methods (without file I/O)
 */
describe("String Generation Methods", () => {
	const fixturePath = TestUtils.getFixturePath("simple.yaml");

	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: fixturePath,
			...options,
		});
		return generator.generateString();
	}

	it("should generate schemas as string without writing to file", () => {
		const output = generateOutput();

		expect(output).toContain('import { z } from "zod"');
		expect(output).toContain("export const userSchema");
		expect(output).toContain("z.object({");
	});

	it("should work without output path when using generateString()", () => {
		const output = generateOutput();
		expect(output).toBeTruthy();
		expect(output.length).toBeGreaterThan(0);
	});

	it("should throw error when calling generate() without output path", () => {
		const generator = new OpenApiGenerator({
			input: fixturePath,
		});

		expect(() => generator.generate()).toThrow(
			"Output path is required when calling generate(). " +
				"Either provide an 'output' option or use generateString() to get the result as a string."
		);
	});

	it("should generate schemas with output path provided", () => {
		const output = generateOutput({
			output: TestUtils.getOutputPath("with-output.ts"),
		});

		expect(output).toBeTruthy();
		expect(output).toContain("export const userSchema");
	});
});
