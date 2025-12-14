import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Validation Modes", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("simple.yaml"),
			...options,
		});
		return generator.generateString();
	}

	describe("Normal Mode", () => {
		it("should use z.object for normal mode", () => {
			const output = generateOutput({ mode: "normal" });
			expect(output).toContain("z.object({");
			expect(output).not.toContain("z.strictObject");
			expect(output).not.toContain("z.looseObject");
		});

		it("should default to normal mode when not specified", () => {
			const output = generateOutput();
			expect(output).toContain("z.object({");
		});
	});

	describe("Strict Mode", () => {
		it("should use z.strictObject for strict mode", () => {
			const output = generateOutput({ mode: "strict" });
			expect(output).toContain("z.strictObject({");
			expect(output).not.toContain("z.object({");
			expect(output).not.toContain("z.looseObject");
		});

		it("should apply strict mode to all object schemas", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("complex.yaml"),
				mode: "strict",
			});
			const output = generator.generateString();
			const objectCount = (output.match(/z\.strictObject\(/g) || []).length;
			expect(objectCount).toBeGreaterThan(0);
		});
	});

	describe("Loose Mode", () => {
		it("should use z.looseObject for loose mode", () => {
			const output = generateOutput({ mode: "loose" });
			expect(output).toContain("z.looseObject({");
			expect(output).not.toContain("z.object({");
			expect(output).not.toContain("z.strictObject");
		});

		it("should apply loose mode to all object schemas", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("complex.yaml"),
				mode: "loose",
			});
			const output = generator.generateString();
			const objectCount = (output.match(/z\.looseObject\(/g) || []).length;
			expect(objectCount).toBeGreaterThan(0);
		});
	});

	describe("Mode Consistency", () => {
		it("should apply the same mode to nested objects", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("complex.yaml"),
				mode: "strict",
			});
			const output = generator.generateString();
			// All z.object calls should be z.strictObject
			expect(output).not.toMatch(/(?<!strict|loose)z\.object\(/);
		});
	});
});
