import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";
import type { GeneratorOptions } from "../src/types";

describe("Validation Modes", () => {
	const outputPath = "tests/output/validation-modes.ts";

	afterEach(() => {
		if (existsSync(outputPath)) {
			unlinkSync(outputPath);
		}
	});

	describe("Normal Mode", () => {
		it("should use z.object for normal mode", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: outputPath,
				mode: "normal",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("z.object({");
			expect(output).not.toContain("z.strictObject");
			expect(output).not.toContain("z.looseObject");
		});

		it("should default to normal mode when not specified", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: outputPath,
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("z.object({");
		});
	});

	describe("Strict Mode", () => {
		it("should use z.strictObject for strict mode", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: outputPath,
				mode: "strict",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("z.strictObject({");
			expect(output).not.toContain("z.object({");
			expect(output).not.toContain("z.looseObject");
		});

		it("should apply strict mode to all object schemas", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/complex.yaml",
				output: outputPath,
				mode: "strict",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			const objectCount = (output.match(/z\.strictObject\(/g) || []).length;
			expect(objectCount).toBeGreaterThan(0);
		});
	});

	describe("Loose Mode", () => {
		it("should use z.looseObject for loose mode", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: outputPath,
				mode: "loose",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("z.looseObject({");
			expect(output).not.toContain("z.object({");
			expect(output).not.toContain("z.strictObject");
		});

		it("should apply loose mode to all object schemas", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/complex.yaml",
				output: outputPath,
				mode: "loose",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			const objectCount = (output.match(/z\.looseObject\(/g) || []).length;
			expect(objectCount).toBeGreaterThan(0);
		});
	});

	describe("Mode Consistency", () => {
		it("should apply the same mode to nested objects", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/complex.yaml",
				output: outputPath,
				mode: "strict",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			// All z.object calls should be z.strictObject
			expect(output).not.toMatch(/(?<!strict|loose)z\.object\(/);
		});
	});
});
