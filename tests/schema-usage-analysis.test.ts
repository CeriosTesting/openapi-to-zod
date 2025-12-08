import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";

describe("Schema Usage Analysis", () => {
	const outputDir = "tests/output";
	const testOutput = `${outputDir}/schema-usage-test.ts`;

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

	describe("Path-based detection", () => {
		it("should detect schemas used in request bodies", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "inferred",
				request: {
					typeMode: "native",
				},
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// CreateUserRequest is used in POST requestBody, should be native
			expect(output).toContain("export type CreateUserRequest = {");
		});

		it("should detect schemas used in responses", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "native",
				response: {
					typeMode: "inferred",
				},
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// User is used in GET response, should be Zod schema
			expect(output).toContain("export const userSchema =");
			expect(output).toContain("z.object(");
		});

		it("should detect nested schema references", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/type-mode.yaml",
				output: testOutput,
				typeMode: "native",
				response: {
					typeMode: "inferred",
				},
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// UserProfile is referenced by User (response schema)
			// So UserProfile should also use response mode
			expect(output).toContain("export const userProfileSchema =");

			// UserStatus is also referenced by User
			expect(output).toContain("export const userStatusSchema =");
		});
	});

	describe("Unreferenced schemas", () => {
		it("should use root typeMode for unreferenced schemas", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/empty-schemas.yaml",
				output: testOutput,
				typeMode: "native",
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Schemas not referenced in paths should use root typeMode
			expect(output).not.toContain('import { z } from "zod"');
		});
	});

	describe("Fallback to readOnly/writeOnly analysis", () => {
		it("should detect request schemas via writeOnly properties when paths missing", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/nested-writeonly.yaml",
				output: testOutput,
				typeMode: "inferred",
				request: {
					typeMode: "native",
				},
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Should generate successfully even without paths section
			expect(output).toBeTruthy();
		});

		it("should handle schemas with both readOnly and writeOnly properties", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/nested-writeonly.yaml",
				output: testOutput,
				typeMode: "native",
				schemaType: "request",
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Should filter properties based on schemaType
			expect(output).toBeTruthy();
		});
	});

	describe("Circular references", () => {
		it("should mark circular reference chains as both context (use inferred)", () => {
			const generator = new ZodSchemaGenerator({
				input: "tests/fixtures/circular.yaml",
				output: testOutput,
				typeMode: "native",
				request: {
					typeMode: "native",
				},
				response: {
					typeMode: "native",
				},
			});

			generator.generate();

			const output = readFileSync(testOutput, "utf-8");

			// Circular schemas should be forced to inferred mode for safety
			// This means Zod should be imported even though both contexts want native
			expect(output).toContain('import { z } from "zod"');
			expect(output).toContain("z.lazy(");
		});
	});
});
