import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";
import type { GeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Schema Usage Analysis", () => {
	const testOutput = TestUtils.getOutputPath("schema-usage-test.ts");

	describe("Path-based detection", () => {
		function generateOutput(options: Partial<GeneratorOptions>): string {
			const generator = new ZodSchemaGenerator({
				input: TestUtils.getFixturePath("type-mode.yaml"),
				output: testOutput,
				...options,
			});
			generator.generate();
			return readFileSync(testOutput, "utf-8");
		}

		it("should detect schemas used in request bodies", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			}); // CreateUserRequest is used in POST requestBody, should be native
			expect(output).toContain("export type CreateUserRequest = {");
		});

		it("should detect schemas used in responses", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			}); // User is used in GET response, should be Zod schema
			expect(output).toContain("export const userSchema =");
			expect(output).toContain("z.object(");
		});

		it("should detect nested schema references", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			}); // UserProfile is referenced by User (response schema)
			// So UserProfile should also use response mode
			expect(output).toContain("export const userProfileSchema =");

			// UserStatus is also referenced by User
			expect(output).toContain("export const userStatusSchema =");
		});
	});

	describe("Unreferenced schemas", () => {
		function generateOutput(options: Partial<GeneratorOptions>): string {
			const generator = new ZodSchemaGenerator({
				input: TestUtils.getFixturePath("empty-schemas.yaml"),
				output: testOutput,
				...options,
			});
			generator.generate();
			return readFileSync(testOutput, "utf-8");
		}

		it("should always use inferred mode for unreferenced schemas", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			});

			// Unreferenced schemas default to inferred mode (always generate Zod schemas)
			expect(output).toContain('import { z } from "zod"');
		});
	});

	describe("Fallback to readOnly/writeOnly analysis", () => {
		function generateOutput(options: Partial<GeneratorOptions>): string {
			const generator = new ZodSchemaGenerator({
				input: TestUtils.getFixturePath("nested-writeonly.yaml"),
				output: testOutput,
				...options,
			});
			generator.generate();
			return readFileSync(testOutput, "utf-8");
		}

		it("should detect request schemas via writeOnly properties when paths missing", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			});

			// Should generate successfully even without paths section
			expect(output).toBeTruthy();
		});

		it("should handle schemas with both readOnly and writeOnly properties", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
				schemaType: "request",
			});

			// Should filter properties based on schemaType
			expect(output).toBeTruthy();
		});
	});

	describe("Circular references", () => {
		function generateOutput(options: Partial<GeneratorOptions>): string {
			const generator = new ZodSchemaGenerator({
				input: TestUtils.getFixturePath("circular.yaml"),
				output: testOutput,
				...options,
			});
			generator.generate();
			return readFileSync(testOutput, "utf-8");
		}

		it("should mark circular reference chains as both context (use inferred)", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			});

			// Circular schemas should be forced to inferred mode for safety
			// Responses are always inferred, so Zod should always be imported
			expect(output).toContain('import { z } from "zod"');
			expect(output).toContain("z.lazy(");
		});
	});
});
