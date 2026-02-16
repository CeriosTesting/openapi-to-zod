import { describe, expect, it } from "vitest";

import { numericToEnumMember, stringToEnumMember } from "../src/utils/enum-utils";

describe("stringToEnumMember", () => {
	describe("basic conversion", () => {
		it("should convert simple string to PascalCase", () => {
			expect(stringToEnumMember("active")).toBe("Active");
			expect(stringToEnumMember("pending")).toBe("Pending");
		});

		it("should handle camelCase input", () => {
			expect(stringToEnumMember("externalKey")).toBe("Externalkey");
		});

		it("should handle UPPERCASE input", () => {
			expect(stringToEnumMember("GET")).toBe("Get");
			expect(stringToEnumMember("POST")).toBe("Post");
		});

		it("should handle snake_case input", () => {
			expect(stringToEnumMember("foo_bar")).toBe("FooBar");
			expect(stringToEnumMember("hello_world")).toBe("HelloWorld");
		});

		it("should handle kebab-case input", () => {
			expect(stringToEnumMember("foo-bar")).toBe("FooBar");
			expect(stringToEnumMember("hello-world")).toBe("HelloWorld");
		});

		it("should handle empty string", () => {
			expect(stringToEnumMember("")).toBe("Empty");
		});

		it("should handle string starting with number", () => {
			expect(stringToEnumMember("123abc")).toBe("Value123abc");
		});

		it("should handle string with only special chars", () => {
			expect(stringToEnumMember("@#$")).toBe("Value");
		});
	});

	describe("sort option prefixes", () => {
		it("should append Desc suffix for - prefix", () => {
			expect(stringToEnumMember("-externalKey")).toBe("ExternalkeyDesc");
			expect(stringToEnumMember("-name")).toBe("NameDesc");
			expect(stringToEnumMember("-code")).toBe("CodeDesc");
		});

		it("should append Asc suffix for + prefix", () => {
			expect(stringToEnumMember("+externalKey")).toBe("ExternalkeyAsc");
			expect(stringToEnumMember("+name")).toBe("NameAsc");
			expect(stringToEnumMember("+date")).toBe("DateAsc");
		});

		it("should handle just - as Desc", () => {
			expect(stringToEnumMember("-")).toBe("Desc");
		});

		it("should handle just + as Asc", () => {
			expect(stringToEnumMember("+")).toBe("Asc");
		});
	});

	describe("deduplication with usedKeys", () => {
		it("should prevent duplicate keys by appending numeric suffix", () => {
			const usedKeys = new Set<string>();

			expect(stringToEnumMember("foo_bar", usedKeys)).toBe("FooBar");
			expect(stringToEnumMember("foo-bar", usedKeys)).toBe("FooBar2");
			expect(stringToEnumMember("foo bar", usedKeys)).toBe("FooBar3");
		});

		it("should handle sort options without duplicates", () => {
			const usedKeys = new Set<string>();

			expect(stringToEnumMember("externalKey", usedKeys)).toBe("Externalkey");
			expect(stringToEnumMember("-externalKey", usedKeys)).toBe("ExternalkeyDesc");
			expect(stringToEnumMember("+externalKey", usedKeys)).toBe("ExternalkeyAsc");
		});

		it("should handle full sort options list", () => {
			const usedKeys = new Set<string>();

			expect(stringToEnumMember("externalKey", usedKeys)).toBe("Externalkey");
			expect(stringToEnumMember("name", usedKeys)).toBe("Name");
			expect(stringToEnumMember("code", usedKeys)).toBe("Code");
			expect(stringToEnumMember("-externalKey", usedKeys)).toBe("ExternalkeyDesc");
			expect(stringToEnumMember("-name", usedKeys)).toBe("NameDesc");
			expect(stringToEnumMember("-code", usedKeys)).toBe("CodeDesc");
		});

		it("should handle multiple collisions", () => {
			const usedKeys = new Set<string>();

			expect(stringToEnumMember("test", usedKeys)).toBe("Test");
			expect(stringToEnumMember("TEST", usedKeys)).toBe("Test2");
			expect(stringToEnumMember("Test", usedKeys)).toBe("Test3");
			expect(stringToEnumMember("test_", usedKeys)).toBe("Test4");
		});

		it("should work without usedKeys parameter", () => {
			// Without usedKeys, duplicates are not tracked
			expect(stringToEnumMember("foo_bar")).toBe("FooBar");
			expect(stringToEnumMember("foo-bar")).toBe("FooBar");
		});
	});
});

describe("numericToEnumMember", () => {
	describe("numeric values", () => {
		it("should convert positive numbers", () => {
			expect(numericToEnumMember(5)).toBe("Value5");
			expect(numericToEnumMember(0)).toBe("Value0");
			expect(numericToEnumMember(123)).toBe("Value123");
		});

		it("should handle negative numbers with Neg prefix", () => {
			expect(numericToEnumMember(-5)).toBe("ValueNeg5");
			expect(numericToEnumMember(-123)).toBe("ValueNeg123");
		});
	});

	describe("string representations with prefixes", () => {
		it("should handle + prefix with Asc suffix", () => {
			expect(numericToEnumMember("+5")).toBe("Value5Asc");
			expect(numericToEnumMember("+123")).toBe("Value123Asc");
		});

		it("should handle - prefix with Desc suffix", () => {
			expect(numericToEnumMember("-5")).toBe("Value5Desc");
			expect(numericToEnumMember("-123")).toBe("Value123Desc");
		});

		it("should handle plain string numbers", () => {
			expect(numericToEnumMember("5")).toBe("Value5");
			expect(numericToEnumMember("123")).toBe("Value123");
		});
	});

	describe("deduplication with usedKeys", () => {
		it("should prevent duplicate keys", () => {
			const usedKeys = new Set<string>();

			expect(numericToEnumMember(5, usedKeys)).toBe("Value5");
			expect(numericToEnumMember("+5", usedKeys)).toBe("Value5Asc");
			expect(numericToEnumMember("-5", usedKeys)).toBe("Value5Desc");
		});

		it("should handle collisions with numeric suffix", () => {
			const usedKeys = new Set<string>();

			expect(numericToEnumMember(5, usedKeys)).toBe("Value5");
			expect(numericToEnumMember("5", usedKeys)).toBe("Value52");
		});
	});
});
