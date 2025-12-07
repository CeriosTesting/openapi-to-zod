import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";

describe("Content Encoding and Media Type", () => {
	const outputPath = join(__dirname, "output", "content-encoding.ts");

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

	describe("Base64 Content Encoding", () => {
		it("should generate base64 validation with contentEncoding", () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "content-encoding.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("Base64Data");
			expect(output).toContain("z.base64()");
		});

		it("should validate base64 strings", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "content-encoding.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { base64DataSchema } = await import(outputPath);

			// Valid base64
			const valid = "SGVsbG8gV29ybGQ=";
			expect(() => base64DataSchema.parse(valid)).not.toThrow();

			// Invalid base64
			const invalid = "Not base64!!!";
			expect(() => base64DataSchema.parse(invalid)).toThrow();
		});

		it("should respect length constraints with base64", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "content-encoding.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { base64DataSchema } = await import(outputPath);

			// Too short (less than 4 chars)
			const tooShort = "SGU";
			expect(tooShort.length).toBeLessThan(4);
			expect(() => base64DataSchema.parse(tooShort)).toThrow(); // Valid length
			const validLength = "SGVsbG8="; // 8 chars
			expect(() => base64DataSchema.parse(validLength)).not.toThrow();
		});
	});

	describe("JSON Content Media Type", () => {
		it("should generate JSON validation with contentMediaType", () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "content-encoding.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("JsonString");
			expect(output).toContain("JSON.parse");
		});

		it("should validate JSON strings", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "content-encoding.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { jsonStringSchema } = await import(outputPath);

			// Valid JSON
			const valid1 = '{"key": "value"}';
			expect(() => jsonStringSchema.parse(valid1)).not.toThrow();

			const valid2 = "[1, 2, 3]";
			expect(() => jsonStringSchema.parse(valid2)).not.toThrow();

			// Invalid JSON
			const invalid = "{not valid json}";
			expect(() => jsonStringSchema.parse(invalid)).toThrow();
		});
	});

	describe("Combined Content Encoding and Media Type", () => {
		it("should handle both contentMediaType and contentEncoding", () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "content-encoding.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("BinaryFile");
			// When both are present, base64 takes precedence
			expect(output).toContain("z.base64()");
		});
	});

	describe("Content Encoding with Pattern", () => {
		it("should apply both base64 and pattern validation", () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "content-encoding.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("PlainWithEncoding");
			expect(output).toContain("z.base64()");
			// Note: Pattern is applied after base64 in our implementation
		});
	});
});
