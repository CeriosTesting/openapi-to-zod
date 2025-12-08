import { describe, expect, it } from "vitest";
import { resolveRef, toCamelCase, toPascalCase } from "../../src/utils/name-utils";

describe("Name Utilities", () => {
	describe("toCamelCase", () => {
		it("should convert PascalCase to camelCase", () => {
			expect(toCamelCase("UserSchema")).toBe("userSchema");
		});

		it("should handle already camelCase", () => {
			expect(toCamelCase("userSchema")).toBe("userSchema");
		});

		it("should add prefix", () => {
			expect(toCamelCase("User", { prefix: "api" })).toBe("apiUser");
		});

		it("should add suffix", () => {
			expect(toCamelCase("User", { suffix: "Dto" })).toBe("userDto");
		});

		it("should add both prefix and suffix", () => {
			expect(toCamelCase("User", { prefix: "api", suffix: "Dto" })).toBe("apiUserDto");
		});

		it("should handle single character", () => {
			expect(toCamelCase("A")).toBe("a");
		});

		it("should handle numbers in name", () => {
			expect(toCamelCase("User123")).toBe("user123");
		});

		it("should handle underscores", () => {
			expect(toCamelCase("User_Name")).toBe("user_Name");
		});
	});

	describe("toPascalCase", () => {
		it("should convert lowercase to PascalCase", () => {
			expect(toPascalCase("user")).toBe("User");
		});

		it("should handle camelCase", () => {
			expect(toPascalCase("userName")).toBe("Username");
		});

		it("should handle snake_case", () => {
			expect(toPascalCase("user_name")).toBe("UserName");
		});

		it("should handle kebab-case", () => {
			expect(toPascalCase("user-name")).toBe("UserName");
		});

		it("should handle spaces", () => {
			expect(toPascalCase("user name")).toBe("UserName");
		});

		it("should handle mixed separators", () => {
			expect(toPascalCase("user-name_test")).toBe("UserNameTest");
		});

		it("should prefix numbers with N", () => {
			expect(toPascalCase("123")).toBe("N123");
			expect(toPascalCase("404_error")).toBe("N404Error");
		});

		it("should handle numeric strings", () => {
			expect(toPascalCase(404)).toBe("N404");
		});

		it("should handle special characters", () => {
			expect(toPascalCase("user@name")).toBe("UserName");
			expect(toPascalCase("user.name")).toBe("UserName");
			expect(toPascalCase("user/name")).toBe("UserName");
		});

		it("should handle emoji and unicode", () => {
			expect(toPascalCase("user😀name")).toBe("UserName");
			expect(toPascalCase("user™name")).toBe("UserName");
		});

		it("should handle empty result fallback", () => {
			expect(toPascalCase("@@@")).toBe("Value");
			expect(toPascalCase("___")).toBe("Value");
		});

		it("should handle all caps", () => {
			expect(toPascalCase("USER")).toBe("User");
			expect(toPascalCase("API_KEY")).toBe("ApiKey");
		});

		it("should preserve consecutive caps", () => {
			expect(toPascalCase("XMLParser")).toBe("Xmlparser");
		});

		it("should handle dots in enum values", () => {
			expect(toPascalCase("v1.0.0")).toBe("V100");
		});
	});

	describe("resolveRef", () => {
		it("should extract schema name from $ref", () => {
			expect(resolveRef("#/components/schemas/User")).toBe("User");
		});

		it("should handle nested paths", () => {
			expect(resolveRef("#/components/schemas/models/User")).toBe("User");
		});

		it("should handle parameters", () => {
			expect(resolveRef("#/components/parameters/userId")).toBe("userId");
		});

		it("should handle responses", () => {
			expect(resolveRef("#/components/responses/NotFound")).toBe("NotFound");
		});

		it("should handle single segment", () => {
			expect(resolveRef("User")).toBe("User");
		});

		it("should handle URL-style refs", () => {
			expect(resolveRef("./schemas.yaml#/components/schemas/User")).toBe("User");
		});

		it("should handle empty string", () => {
			expect(resolveRef("")).toBe("");
		});

		it("should handle refs with special characters", () => {
			expect(resolveRef("#/components/schemas/User-Model")).toBe("User-Model");
		});
	});
});
