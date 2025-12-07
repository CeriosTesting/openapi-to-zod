import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";

describe("Pattern Properties", () => {
	const outputPath = join(__dirname, "output", "pattern-properties.ts");

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

	describe("Pattern Properties", () => {
		it("should generate validation for pattern properties", () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "pattern-properties.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("DynamicConfig");
			expect(output).toContain("refine");
			expect(output).toContain("^config_[a-z]+$");
		});

		it("should validate objects with pattern properties", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "pattern-properties.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { dynamicConfigSchema } = await import(outputPath);

			// Valid object
			const valid = {
				name: "test",
				config_foo: "value1",
				config_bar: "value2",
				num_count: 42,
			};
			expect(() => dynamicConfigSchema.parse(valid)).not.toThrow();

			// Invalid: config_ properties must be strings
			const invalid1 = {
				name: "test",
				config_foo: 123, // Should be string
			};
			expect(() => dynamicConfigSchema.parse(invalid1)).toThrow(); // Invalid: num_ properties must be numbers
			const invalid2 = {
				name: "test",
				num_count: "not a number", // Should be number
			};
			expect(() => dynamicConfigSchema.parse(invalid2)).toThrow();
		});
	});

	describe("Property Names Validation", () => {
		it("should generate validation for property name patterns", () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "pattern-properties.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("StringKeysOnly");
			expect(output).toContain("^[a-zA-Z_]+$");
		});

		it("should validate property names with pattern", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "pattern-properties.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { stringKeysOnlySchema } = await import(outputPath);

			// Valid: only letters and underscores
			const valid = {
				foo: "bar",
				foo_bar: "baz",
				CAPS: "value",
			};
			expect(() => stringKeysOnlySchema.parse(valid)).not.toThrow();

			// Invalid: contains numbers
			const invalid = {
				foo123: "bar",
			};
			expect(() => stringKeysOnlySchema.parse(invalid)).toThrow();
		});

		it("should validate property names with maxLength", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "pattern-properties.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { shortKeysOnlySchema } = await import(outputPath);

			// Valid: keys are 10 chars or less
			const valid = {
				short: "value",
				tenletters: "value",
			};
			expect(() => shortKeysOnlySchema.parse(valid)).not.toThrow();

			// Invalid: key is too long
			const invalid = {
				thisiswaytoolong: "value",
			};
			expect(() => shortKeysOnlySchema.parse(invalid)).toThrow();
		});

		it("should validate property names with minLength", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "pattern-properties.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { longKeysOnlySchema } = await import(outputPath);

			// Valid: keys are 5+ chars
			const valid = {
				validkey: "value",
				longerkey: "value",
			};
			expect(() => longKeysOnlySchema.parse(valid)).not.toThrow();

			// Invalid: key is too short
			const invalid = {
				foo: "value",
			};
			expect(() => longKeysOnlySchema.parse(invalid)).toThrow();
		});
	});

	describe("Combined Validation", () => {
		it("should handle both pattern properties and property names", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "pattern-properties.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { combinedValidationSchema } = await import(outputPath);

			// Valid: matches all rules
			const valid = {
				id: "test",
				data_1: { value: 100 },
				data_2: { value: 200 },
			};
			expect(() => combinedValidationSchema.parse(valid)).not.toThrow();

			// Invalid: property name has uppercase
			const invalid1 = {
				id: "test",
				DATA_1: { value: 100 },
			};
			expect(() => combinedValidationSchema.parse(invalid1)).toThrow();

			// Invalid: data_ property doesn't match schema
			const invalid2 = {
				id: "test",
				data_1: { value: "not a number" },
			};
			expect(() => combinedValidationSchema.parse(invalid2)).toThrow();
		});
	});
});
