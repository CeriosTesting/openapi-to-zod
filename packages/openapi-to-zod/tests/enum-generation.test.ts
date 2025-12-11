import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";
import type { GeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Enum Generation", () => {
	describe("Zod Enums", () => {
		function generateWithZodEnum(fixture: string, options?: Partial<GeneratorOptions>): string {
			const generator = new ZodSchemaGenerator({
				input: TestUtils.getFixturePath(fixture),
				mode: "normal",
				enumType: "zod",
				...options,
			});
			return generator.generateString();
		}

		it("should generate zod enums by default", () => {
			const output = generateWithZodEnum("simple.yaml");

			expect(output).toContain("z.enum([");
			expect(output).toContain('"active"');
			expect(output).toContain('"inactive"');
			expect(output).toContain('"pending"');
			expect(output).not.toContain("export enum");
		});

		it("should include type inference for zod enums", () => {
			const output = generateWithZodEnum("simple.yaml");

			expect(output).toContain("export type Status = z.infer<typeof statusSchema>");
		});

		it("should handle numeric enums as strings in zod mode", () => {
			const output = generateWithZodEnum("complex.yaml");

			// Numeric values should be converted to strings
			expect(output).toContain('"1"');
			expect(output).toContain('"2"');
			expect(output).toContain('"3"');
		});
	});

	describe("TypeScript Enums", () => {
		function generateWithTSEnum(fixture: string, options?: Partial<GeneratorOptions>): string {
			const outputFile = `enum-ts-${fixture.replace(".yaml", "")}.ts`;
			const generator = new ZodSchemaGenerator({
				input: TestUtils.getFixturePath(fixture),
				output: TestUtils.getOutputPath(outputFile),
				mode: "normal",
				enumType: "typescript",
				nativeEnumType: "enum",
				...options,
			});
			generator.generate();
			return readFileSync(TestUtils.getOutputPath(outputFile), "utf-8");
		}

		it("should generate TypeScript enums when specified", () => {
			const output = generateWithTSEnum("simple.yaml");
			expect(output).toContain("export enum StatusEnum {");
			expect(output).toContain('Active = "active"');
			expect(output).toContain('Inactive = "inactive"');
			expect(output).toContain('Pending = "pending"');
		});

		it("should reference TypeScript enums in schemas", () => {
			const output = generateWithTSEnum("simple.yaml");

			expect(output).toContain("z.nativeEnum(StatusEnum)");
		});

		it("should include type inference for TypeScript enums", () => {
			const output = generateWithTSEnum("simple.yaml");

			expect(output).toContain("export type Status = z.infer<typeof statusSchema>");
		});

		it("should handle duplicate enum keys", () => {
			const output = generateWithTSEnum("complex.yaml");

			// Should generate valid TypeScript enum with no duplicate keys
			expect(output).toMatch(/export enum \w+Enum \{/);
		});

		it("should prefix numeric enum keys with N", () => {
			const output = generateWithTSEnum("complex.yaml");

			// Numeric keys should be prefixed with N
			expect(output).toMatch(/N\d+ = /);
		});
	});

	describe("Enum Naming", () => {
		function generateWithTSEnum(fixture: string, options?: Partial<GeneratorOptions>): string {
			const outputFile = `enum-naming-${fixture.replace(".yaml", "")}.ts`;
			const generator = new ZodSchemaGenerator({
				input: TestUtils.getFixturePath(fixture),
				output: TestUtils.getOutputPath(outputFile),
				mode: "normal",
				enumType: "typescript",
				nativeEnumType: "enum",
				...options,
			});
			generator.generate();
			return readFileSync(TestUtils.getOutputPath(outputFile), "utf-8");
		}

		it("should convert enum values to PascalCase for TypeScript enums", () => {
			const output = generateWithTSEnum("simple.yaml");

			expect(output).toMatch(/Active = "active"/);
			expect(output).toMatch(/Inactive = "inactive"/);
			expect(output).toMatch(/Pending = "pending"/);
		});

		it("should handle EnumOptions suffix correctly", () => {
			const output = generateWithTSEnum("complex.yaml");

			// EnumOptions should be replaced with Enum
			expect(output).toMatch(/Enum \{/);
		});
	});

	describe("Edge Cases", () => {
		function generateWithZodEnum(fixture: string, options?: Partial<GeneratorOptions>): string {
			const generator = new ZodSchemaGenerator({
				input: TestUtils.getFixturePath(fixture),
				mode: "normal",
				enumType: "zod",
				...options,
			});
			return generator.generateString();
		}

		function generateWithTSEnum(fixture: string, options?: Partial<GeneratorOptions>): string {
			const outputFile = `enum-edge-${fixture.replace(".yaml", "")}.ts`;
			const generator = new ZodSchemaGenerator({
				input: TestUtils.getFixturePath(fixture),
				output: TestUtils.getOutputPath(outputFile),
				mode: "normal",
				enumType: "typescript",
				nativeEnumType: "enum",
				...options,
			});
			generator.generate();
			return readFileSync(TestUtils.getOutputPath(outputFile), "utf-8");
		}

		it("should handle single value enum", () => {
			const output = generateWithZodEnum("edge-cases.yaml");

			expect(output).toContain("singleValueEnumSchema");
			expect(output).toContain("z.enum(");
		});

		it("should handle enum with special characters", () => {
			const output = generateWithTSEnum("edge-cases.yaml");

			// Should sanitize special characters in enum keys
			expect(output).toMatch(/export enum \w+Enum \{/);
		});
	});
});
