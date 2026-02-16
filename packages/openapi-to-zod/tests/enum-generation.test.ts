import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";

import { TestUtils } from "./utils/test-utils";

describe("Enum Generation", () => {
	describe("Zod Enums", () => {
		function generateWithZodEnum(fixture: string, options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath(fixture),
				outputTypes: "output.ts",
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

		it("should handle numeric enums as literal unions", () => {
			const output = generateWithZodEnum("complex.yaml");

			// Numeric values should be generated as z.literal() in a union
			expect(output).toContain("z.union([");
			expect(output).toContain("z.literal(1)");
			expect(output).toContain("z.literal(2)");
			expect(output).toContain("z.literal(3)");
		});

		it("should handle mixed string and numeric enums", () => {
			const output = generateWithZodEnum("edge-cases.yaml");

			// Mixed enums should generate z.union with both string and numeric literals
			expect(output).toContain("mixedEnumSchema");
			expect(output).toContain("z.union([");
			expect(output).toContain("z.literal(0)");
			expect(output).toContain('z.literal("none")');
			expect(output).toContain("z.literal(1)");
			expect(output).toContain('z.literal("some")');
			expect(output).toContain("z.literal(2)");
			expect(output).toContain('z.literal("many")');
		});

		it("should handle boolean enums", () => {
			const output = generateWithZodEnum("edge-cases.yaml");

			// Boolean enums should generate z.boolean()
			expect(output).toContain("booleanEnumSchema");
			expect(output).toContain("export const booleanEnumSchema = z.boolean()");
			expect(output).not.toContain("z.literal(true)");
			expect(output).not.toContain("z.literal(false)");
		});

		it("should handle float/decimal enums", () => {
			const output = generateWithZodEnum("edge-cases.yaml");

			// Float enums should generate z.union with numeric literals
			// Note: JavaScript normalizes 0.0 to 0 and 1.0 to 1
			expect(output).toContain("floatEnumSchema");
			expect(output).toContain("z.union([");
			expect(output).toContain("z.literal(0)");
			expect(output).toContain("z.literal(0.5)");
			expect(output).toContain("z.literal(1)");
			expect(output).toContain("z.literal(1.5)");
		});
	});

	describe("Edge Cases", () => {
		function generateWithZodEnum(fixture: string, options?: Partial<OpenApiGeneratorOptions>): string {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath(fixture),
				outputTypes: "output.ts",
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
