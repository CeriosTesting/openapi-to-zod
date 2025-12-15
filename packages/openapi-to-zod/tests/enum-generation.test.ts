import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Enum Generation", () => {
	describe("Zod Enums", () => {
		function generateWithZodEnum(fixture: string, options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath(fixture),
				mode: "normal",
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

	describe("Edge Cases", () => {
		function generateWithZodEnum(fixture: string, options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath(fixture),
				mode: "normal",
				...options,
			});
			return generator.generateString();
		}

		it("should handle single value enum", () => {
			const output = generateWithZodEnum("edge-cases.yaml");

			expect(output).toContain("singleValueEnumSchema");
			expect(output).toContain("z.enum(");
		});
	});
});
