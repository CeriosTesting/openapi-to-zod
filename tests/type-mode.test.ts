import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";

describe("Type Mode Generation", () => {
	const outputDir = "tests/output";
	const testOutput = `${outputDir}/type-mode-test.ts`;

	beforeEach(() => {
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true });
		}
	});

	afterEach(() => {
		// Clean up generated files
		if (existsSync(testOutput)) {
			rmSync(testOutput);
		}
	});

	describe("typeMode: inferred (default)", () => {
		it("should generate Zod schemas with z.infer types by default", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

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
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "inferred",
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

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

	describe("typeMode: native", () => {
		it("should generate native TypeScript types without Zod", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "native",
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Should NOT import Zod
			expect(output).not.toContain('import { z } from "zod"');

			// Should generate TypeScript types
			expect(output).toContain("export type User = {");
			expect(output).toContain("export type CreateUserRequest = {");

			// Should NOT generate Zod schemas
			expect(output).not.toContain("export const userSchema = ");
			expect(output).not.toContain("z.object(");
			expect(output).not.toContain("z.infer");
		});

		it("should generate union types for enums by default", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "native",
				nativeEnumType: "union",
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Should generate union type
			expect(output).toContain('export type UserStatus = "active" | "inactive" | "suspended";');

			// Should NOT generate TypeScript enum
			expect(output).not.toContain("enum UserStatusEnum");
		});

		it("should generate TypeScript enums when nativeEnumType is enum", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "native",
				nativeEnumType: "enum",
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Should generate TypeScript enum with Enum suffix
			expect(output).toContain("export enum UserStatusEnum {");
			expect(output).toMatch(/Active = "active"/);
			expect(output).toMatch(/Inactive = "inactive"/);
			expect(output).toMatch(/Suspended = "suspended"/);

			// Should generate type alias
			expect(output).toContain("export type UserStatus = UserStatusEnum;");
		});

		it("should add constraint JSDoc when includeDescriptions is true", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "native",
				includeDescriptions: true,
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Should include constraint annotations in JSDoc
			expect(output).toMatch(/@minLength 1/);
			expect(output).toMatch(/@maxLength 100/);
			expect(output).toMatch(/@pattern/);
			expect(output).toMatch(/@minimum 0/);
			expect(output).toMatch(/@maximum 150/);
			expect(output).toMatch(/@format email/);
		});

		it("should not add constraint JSDoc when includeDescriptions is false", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "native",
				includeDescriptions: false,
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Should NOT include constraint annotations
			expect(output).not.toMatch(/@minLength/);
			expect(output).not.toMatch(/@maxLength/);
			expect(output).not.toMatch(/@minimum/);
			expect(output).not.toMatch(/@maximum/);
		});

		it("should handle nested objects and arrays", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "native",
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Should reference nested type
			expect(output).toContain("profile?: UserProfile;");

			// Should generate nested type
			expect(output).toContain("export type UserProfile = {");

			// Should handle arrays
			expect(output).toContain("tags?: string[];");
		});
	});
});
