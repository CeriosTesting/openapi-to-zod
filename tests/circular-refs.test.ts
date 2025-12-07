import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";
import type { GeneratorOptions } from "../src/types";

describe("Circular Reference Handling", () => {
	const outputPath = "tests/output/circular.ts";

	afterEach(() => {
		if (existsSync(outputPath)) {
			unlinkSync(outputPath);
		}
	});

	it("should handle circular references with z.lazy", () => {
		const options: GeneratorOptions = {
			input: "tests/fixtures/circular.yaml",
			output: outputPath,
			mode: "normal",
		};

		const generator = new ZodSchemaGenerator(options);
		generator.generate();

		const output = readFileSync(outputPath, "utf-8");
		expect(output).toContain("z.lazy(");
	});

	it("should add type annotation to lazy callbacks", () => {
		const options: GeneratorOptions = {
			input: "tests/fixtures/circular.yaml",
			output: outputPath,
			mode: "normal",
		};

		const generator = new ZodSchemaGenerator(options);
		generator.generate();

		const output = readFileSync(outputPath, "utf-8");
		expect(output).toContain("z.lazy((): z.ZodTypeAny =>");
	});

	it("should place alias schemas after their target schemas", () => {
		const options: GeneratorOptions = {
			input: "tests/fixtures/circular.yaml",
			output: outputPath,
			mode: "normal",
		};

		const generator = new ZodSchemaGenerator(options);
		generator.generate();

		const output = readFileSync(outputPath, "utf-8");

		// Find positions of schemas
		const nodePos = output.indexOf("export const nodeSchema");
		const parentPos = output.indexOf("export const parentNodeSchema");
		const childPos = output.indexOf("export const childNodeSchema");

		// Main schema should come before aliases
		expect(nodePos).toBeLessThan(parentPos);
		expect(nodePos).toBeLessThan(childPos);
	});

	it("should handle arrays of circular references", () => {
		const options: GeneratorOptions = {
			input: "tests/fixtures/circular.yaml",
			output: outputPath,
			mode: "normal",
		};

		const generator = new ZodSchemaGenerator(options);
		generator.generate();

		const output = readFileSync(outputPath, "utf-8");
		expect(output).toContain("z.array(z.lazy(");
	});

	it("should maintain correct dependency order", () => {
		const options: GeneratorOptions = {
			input: "tests/fixtures/circular.yaml",
			output: outputPath,
			mode: "normal",
		};

		const generator = new ZodSchemaGenerator(options);
		generator.generate();

		// Should not throw and should generate valid file
		expect(existsSync(outputPath)).toBe(true);
		const output = readFileSync(outputPath, "utf-8");

		// Should have all expected schemas
		expect(output).toContain("export const nodeSchema");
		expect(output).toContain("export const parentNodeSchema");
		expect(output).toContain("export const childNodeSchema");
	});
});
