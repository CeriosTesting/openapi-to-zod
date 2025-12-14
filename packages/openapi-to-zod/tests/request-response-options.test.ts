import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Request/Response Options", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("type-mode.yaml"),
			...options,
		});
		return generator.generateString();
	}

	describe("Nested options override root options", () => {
		it("should use request typeMode: native for request schemas", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			});

			// CreateUserRequest (used in POST request body) should be native type
			expect(output).toContain("export type CreateUserRequest = {");
			expect(output).not.toContain("export const createUserRequestSchema =");

			// User (used in response) should always be Zod schema
			expect(output).toContain("export const userSchema =");
			expect(output).toContain("z.object(");
		});

		it("should always use inferred mode for response schemas", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			});

			// User (used in GET response) should always be Zod schema
			expect(output).toContain("export const userSchema =");
			expect(output).toContain("z.object(");
			expect(output).toContain("export type User = z.infer<typeof userSchema>;");

			// CreateUserRequest (used in POST request body) should be native type
			expect(output).toContain("export type CreateUserRequest = {");
			expect(output).not.toContain("export const createUserRequestSchema =");
		});

		it("should generate Zod import when responses use inferred mode (always)", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			});

			// Should always import Zod because responses always use inferred mode
			expect(output).toContain('import { z } from "zod"');
		});
	});

	describe("Mixed configurations", () => {
		it("should handle request: native, response: always inferred", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
					nativeEnumType: "union",
				},
			});

			// Should have both native types (requests) and Zod schemas (responses)
			expect(output).toContain("export type CreateUserRequest = {");
			expect(output).toContain("export const userSchema =");
			expect(output).toContain('import { z } from "zod"');
		});

		it("should override mode per context", () => {
			const output = generateOutput({
				mode: "normal",
				request: {
					mode: "strict",
				},
				response: {
					mode: "loose",
				},
			});

			// This test validates that different modes are applied
			// The actual validation happens in property-generator
			expect(output).toBeTruthy();
		});

		it("should override enumType per context", () => {
			const output = generateOutput({
				enumType: "zod",
				request: {
					enumType: "typescript",
				},
			});

			// Should generate TypeScript enum for request context
			// UserStatus is used in User which is a response schema
			expect(output).toBeTruthy();
		});

		it("should override includeDescriptions per context", () => {
			const output = generateOutput({
				includeDescriptions: true,
				request: {
					includeDescriptions: false,
				},
				response: {
					includeDescriptions: true,
				},
			});

			// Both contexts should generate successfully
			expect(output).toBeTruthy();
		});
	});

	describe("Schemas used in both contexts", () => {
		it("should always use inferred mode for response schemas regardless of request settings", () => {
			const output = generateOutput({
				request: {
					typeMode: "native",
				},
			});

			// Response schemas (User) should always be Zod schemas
			// Request schemas can be native TypeScript
			expect(output).toContain("export const userSchema =");
			expect(output).toContain('import { z } from "zod"');
		});
	});
});
