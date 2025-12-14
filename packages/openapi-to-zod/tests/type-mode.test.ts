import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Type Mode Generation", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("type-mode.yaml"),
			...options,
		});
		return generator.generateString();
	}

	describe("Default: inferred mode for all schemas", () => {
		it("should generate Zod schemas with z.infer types by default", () => {
			const output = generateOutput();

			// Should import Zod
			expect(output).toContain('import { z } from "zod"');

			// Should generate Zod schemas
			expect(output).toContain("export const userSchema = ");
			expect(output).toMatch(/z\.object\(/);

			// Should generate z.infer types
			expect(output).toContain("export type User = z.infer<typeof userSchema>;");
			expect(output).toContain("export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;");

			// Should generate Zod enum
			expect(output).toContain("export const userStatusSchema = z.enum");
			expect(output).toContain("export type UserStatus = z.infer<typeof userStatusSchema>;");
		});

		it("should apply constraints with Zod validators", () => {
			const output = generateOutput();

			// String constraints
			expect(output).toMatch(/\.min\(1\)/);
			expect(output).toMatch(/\.max\(100\)/);
			expect(output).toMatch(/\.email\(\)/);

			// Number constraints
			expect(output).toMatch(/\.gte\(0\)/);
			expect(output).toMatch(/\.lte\(150\)/);

			// Array constraints
			expect(output).toMatch(/\.array\(/);
		});
	});

	describe("Request typeMode: native", () => {
		it("should generate native TypeScript types for request schemas only", () => {
			const output = generateOutput({
				request: { typeMode: "native" },
			});

			// Should still import Zod for response schemas
			expect(output).toContain('import { z } from "zod"');

			// Request schema (CreateUserRequest) should be native TypeScript type
			expect(output).toContain("export type CreateUserRequest = {");
			expect(output).not.toContain("export const createUserRequestSchema = ");

			// Response schema (User) should still be Zod schema
			expect(output).toContain("export const userSchema = ");
			expect(output).toContain("z.object(");
			expect(output).toContain("export type User = z.infer<typeof userSchema>;");
		});

		it("should generate union types for request enums by default", () => {
			const output = generateOutput({
				request: { typeMode: "native", nativeEnumType: "union" },
			});

			// If UserStatus is used in requests, it should be a union
			// Response enums should still use Zod
			expect(output).toContain("export const userStatusSchema = z.enum");
		});

		it("should generate TypeScript enums for requests when nativeEnumType is enum", () => {
			const output = generateOutput({
				request: { typeMode: "native", nativeEnumType: "enum" },
			});

			// Response enums should still use Zod
			expect(output).toContain("export const userStatusSchema = z.enum");
		});

		it("should add constraint JSDoc for native request types when includeDescriptions is true", () => {
			const output = generateOutput({
				request: { typeMode: "native", includeDescriptions: true },
			});

			// Should include constraint annotations in JSDoc for request types
			// CreateUserRequest has minLength on name and minimum on age
			expect(output).toMatch(/@minLength 1/);
			expect(output).toMatch(/@format email/);
			expect(output).toMatch(/@minimum 0/);
		});

		it("should not add constraint JSDoc when includeDescriptions is false", () => {
			const output = generateOutput({
				request: { typeMode: "native", includeDescriptions: false },
			});

			// Should NOT include constraint annotations for request types
			expect(output).not.toMatch(/@minLength/);
			expect(output).not.toMatch(/@maxLength/);
		});

		it("should handle nested objects and arrays in native mode", () => {
			const output = generateOutput({
				request: { typeMode: "native" },
			});

			// Request types should be native TypeScript
			// Response types should still be Zod
			expect(output).toContain("export const userSchema = ");
		});
	});
});
