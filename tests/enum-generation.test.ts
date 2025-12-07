import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";
import type { GeneratorOptions } from "../src/types";

describe("Enum Generation", () => {
	const zodOutputPath = "tests/output/enum-zod.ts";
	const tsOutputPath = "tests/output/enum-ts.ts";

	afterEach(() => {
		[zodOutputPath, tsOutputPath].forEach(path => {
			if (existsSync(path)) {
				unlinkSync(path);
			}
		});
	});

	describe("Zod Enums", () => {
		it("should generate zod enums by default", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: zodOutputPath,
				mode: "normal",
				enumType: "zod",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(zodOutputPath, "utf-8");
			expect(output).toContain("z.enum([");
			expect(output).toContain('"active"');
			expect(output).toContain('"inactive"');
			expect(output).toContain('"pending"');
			expect(output).not.toContain("export enum");
		});

		it("should include type inference for zod enums", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: zodOutputPath,
				mode: "normal",
				enumType: "zod",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(zodOutputPath, "utf-8");
			expect(output).toContain("export type Status = z.infer<typeof statusSchema>");
		});

		it("should handle numeric enums as strings in zod mode", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/complex.yaml",
				output: zodOutputPath,
				mode: "normal",
				enumType: "zod",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(zodOutputPath, "utf-8");
			// Numeric values should be converted to strings
			expect(output).toContain('"1"');
			expect(output).toContain('"2"');
			expect(output).toContain('"3"');
		});
	});

	describe("TypeScript Enums", () => {
		it("should generate TypeScript enums when specified", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: tsOutputPath,
				mode: "normal",
				enumType: "typescript",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(tsOutputPath, "utf-8");
			expect(output).toContain("export enum StatusEnum {");
			expect(output).toContain('Active = "active"');
			expect(output).toContain('Inactive = "inactive"');
			expect(output).toContain('Pending = "pending"');
		});

		it("should reference TypeScript enums in schemas", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: tsOutputPath,
				mode: "normal",
				enumType: "typescript",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(tsOutputPath, "utf-8");
			expect(output).toContain("z.enum(StatusEnum)");
		});

		it("should include type inference for TypeScript enums", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: tsOutputPath,
				mode: "normal",
				enumType: "typescript",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(tsOutputPath, "utf-8");
			expect(output).toContain("export type Status = z.infer<typeof statusSchema>");
		});

		it("should handle duplicate enum keys", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/complex.yaml",
				output: tsOutputPath,
				mode: "normal",
				enumType: "typescript",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(tsOutputPath, "utf-8");
			// Should generate valid TypeScript enum with no duplicate keys
			expect(output).toMatch(/export enum \w+Enum \{/);
		});

		it("should prefix numeric enum keys with N", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/complex.yaml",
				output: tsOutputPath,
				mode: "normal",
				enumType: "typescript",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(tsOutputPath, "utf-8");
			// Numeric keys should be prefixed with N
			expect(output).toMatch(/N\d+ = /);
		});
	});

	describe("Enum Naming", () => {
		it("should convert enum values to PascalCase for TypeScript enums", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: tsOutputPath,
				mode: "normal",
				enumType: "typescript",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(tsOutputPath, "utf-8");
			expect(output).toMatch(/Active = "active"/);
			expect(output).toMatch(/Inactive = "inactive"/);
			expect(output).toMatch(/Pending = "pending"/);
		});

		it("should handle EnumOptions suffix correctly", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/complex.yaml",
				output: tsOutputPath,
				mode: "normal",
				enumType: "typescript",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(tsOutputPath, "utf-8");
			// EnumOptions should be replaced with Enum
			expect(output).toMatch(/Enum \{/);
		});
	});

	describe("Edge Cases", () => {
		it("should handle single value enum", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/edge-cases.yaml",
				output: tsOutputPath,
				mode: "normal",
				enumType: "zod",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(tsOutputPath, "utf-8");
			expect(output).toContain("singleValueEnumSchema");
			expect(output).toContain("z.enum(");
		});

		it("should handle enum with special characters", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/edge-cases.yaml",
				output: tsOutputPath,
				mode: "normal",
				enumType: "typescript",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const output = readFileSync(tsOutputPath, "utf-8");
			// Should sanitize special characters in enum keys
			expect(output).toMatch(/export enum \w+Enum \{/);
		});
	});
});
