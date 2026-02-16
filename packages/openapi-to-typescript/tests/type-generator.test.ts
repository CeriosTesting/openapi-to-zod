import { describe, expect, it } from "vitest";

import { formatTypeProperty, generateTypeDeclaration } from "../src/generators/type-generator.js";

describe("Type Generator", () => {
	describe("generateTypeDeclaration", () => {
		describe("Type Alias Generation", () => {
			it("should generate an empty type", () => {
				const result = generateTypeDeclaration("Empty", [], {});
				expect(result.code).toContain("export type Empty = {");
				expect(result.code).toContain("};");
				expect(result.typeName).toBe("Empty");
			});

			it("should generate type with properties", () => {
				const result = generateTypeDeclaration("User", ["id: string", "name: string", "email?: string"], {});
				expect(result.code).toContain("export type User = {");
				expect(result.code).toContain("id: string");
				expect(result.code).toContain("name: string");
				expect(result.code).toContain("email?: string");
			});

			it("should handle complex property types", () => {
				const result = generateTypeDeclaration(
					"Container",
					["items: string[]", "metadata?: Record<string, unknown>"],
					{}
				);
				expect(result.code).toContain("items: string[]");
				expect(result.code).toContain("metadata?: Record<string, unknown>");
			});

			it("should apply prefix to type name", () => {
				const result = generateTypeDeclaration("User", ["id: string"], {
					prefix: "Api",
				});
				expect(result.typeName).toBe("ApiUser");
				expect(result.code).toContain("export type ApiUser = {");
			});

			it("should apply suffix to type name", () => {
				const result = generateTypeDeclaration("User", ["id: string"], {
					suffix: "Dto",
				});
				expect(result.typeName).toBe("UserDto");
				expect(result.code).toContain("export type UserDto = {");
			});

			it("should apply both prefix and suffix", () => {
				const result = generateTypeDeclaration("User", ["id: string"], {
					prefix: "Api",
					suffix: "Response",
				});
				expect(result.typeName).toBe("ApiUserResponse");
				expect(result.code).toContain("export type ApiUserResponse = {");
			});
		});
	});

	describe("formatTypeProperty", () => {
		it("should format a required property", () => {
			const result = formatTypeProperty("id", "string", true);
			expect(result).toBe("id: string");
		});

		it("should format an optional property", () => {
			const result = formatTypeProperty("email", "string", false);
			expect(result).toBe("email?: string");
		});

		it("should handle array types", () => {
			const result = formatTypeProperty("tags", "string[]", true);
			expect(result).toBe("tags: string[]");
		});

		it("should handle union types", () => {
			const result = formatTypeProperty("value", "string | number", true);
			expect(result).toBe("value: string | number");
		});

		it("should handle nullable types", () => {
			const result = formatTypeProperty("data", "string | null", false);
			expect(result).toBe("data?: string | null");
		});

		it("should handle property names with special characters", () => {
			const result = formatTypeProperty("content-type", "string", true);
			expect(result).toBe('"content-type": string');
		});

		it("should handle property names that are reserved words", () => {
			const result = formatTypeProperty("class", "string", true);
			// Reserved words are valid property names in TypeScript, no need to quote
			expect(result).toBe("class: string");
		});
	});
});
