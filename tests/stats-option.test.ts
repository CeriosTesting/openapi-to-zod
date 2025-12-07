import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";

describe("Stats Option", () => {
	const outputPath = join(__dirname, "output", "stats-option.ts");

	beforeEach(() => {
		if (existsSync(outputPath)) {
			rmSync(outputPath);
		}
	});

	afterEach(() => {
		if (existsSync(outputPath)) {
			rmSync(outputPath);
		}
	});

	it("should include statistics when showStats is true", () => {
		const generator = new ZodSchemaGenerator({
			input: join(__dirname, "fixtures", "simple.yaml"),
			output: outputPath,
			mode: "normal",
			showStats: true,
		});

		generator.generate();

		const output = readFileSync(outputPath, "utf-8");
		expect(output).toContain("// Generation Statistics:");
	});

	it("should exclude statistics when showStats is false", () => {
		const generator = new ZodSchemaGenerator({
			input: join(__dirname, "fixtures", "simple.yaml"),
			output: outputPath,
			mode: "normal",
			showStats: false,
		});

		generator.generate();

		const output = readFileSync(outputPath, "utf-8");
		expect(output).not.toContain("// Generation Statistics:");
	});

	it("should include statistics by default (when showStats is undefined)", () => {
		const generator = new ZodSchemaGenerator({
			input: join(__dirname, "fixtures", "simple.yaml"),
			output: outputPath,
			mode: "normal",
			// showStats not specified
		});

		generator.generate();

		const output = readFileSync(outputPath, "utf-8");
		expect(output).toContain("// Generation Statistics:");
	});

	it("should exclude statistics when showStats is explicitly false vs undefined", () => {
		// Test with false
		const generator1 = new ZodSchemaGenerator({
			input: join(__dirname, "fixtures", "simple.yaml"),
			output: outputPath,
			mode: "normal",
			showStats: false,
		});

		generator1.generate();

		const output1 = readFileSync(outputPath, "utf-8");
		expect(output1).not.toContain("// Generation Statistics:");

		// Test with undefined (default)
		rmSync(outputPath);

		const generator2 = new ZodSchemaGenerator({
			input: join(__dirname, "fixtures", "simple.yaml"),
			output: outputPath,
			mode: "normal",
		});

		generator2.generate();

		const output2 = readFileSync(outputPath, "utf-8");
		expect(output2).toContain("// Generation Statistics:");
	});
});
