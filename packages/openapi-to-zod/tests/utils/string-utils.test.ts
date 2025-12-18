import { describe, expect, it } from "vitest";
import type { OpenAPISchema } from "../../src/types";
import {
	addDescription,
	escapeDescription,
	escapeJSDoc,
	escapePattern,
	getPrimaryType,
	hasMultipleTypes,
	isNullable,
	wrapNullable,
} from "../../src/utils/string-utils";

describe("String Utilities", () => {
	describe("escapeDescription", () => {
		it("should escape backslashes", () => {
			expect(escapeDescription("path\\to\\file")).toBe("path\\\\to\\\\file");
		});

		it("should escape double quotes", () => {
			expect(escapeDescription('Say "hello"')).toBe('Say \\"hello\\"');
		});

		it("should escape newlines", () => {
			expect(escapeDescription("line1\nline2")).toBe("line1\\nline2");
		});

		it("should handle all escapes together", () => {
			expect(escapeDescription('path\\file\n"quoted"')).toBe('path\\\\file\\n\\"quoted\\"');
		});

		it("should handle empty strings", () => {
			expect(escapeDescription("")).toBe("");
		});

		it("should handle strings without special characters", () => {
			expect(escapeDescription("normal text")).toBe("normal text");
		});
	});

	describe("escapePattern", () => {
		it("should not escape backslashes (regex literal handles them)", () => {
			expect(escapePattern("\\d+")).toBe("\\d+");
		});

		it("should not escape single quotes (not needed in regex literal)", () => {
			expect(escapePattern("it's")).toBe("it's");
		});

		it("should escape forward slashes to prevent terminating regex literal", () => {
			expect(escapePattern("date/time")).toBe("date\\/time");
		});

		it("should handle regex patterns without modification", () => {
			expect(escapePattern("^[a-z]+$")).toBe("^[a-z]+$");
		});

		it("should handle complex patterns with forward slashes", () => {
			expect(escapePattern("^https://example.com/path$")).toBe("^https:\\/\\/example.com\\/path$");
		});
	});

	describe("escapeJSDoc", () => {
		it("should escape comment-ending sequence", () => {
			expect(escapeJSDoc("end */")).toBe("end *\\/");
		});

		it("should handle multiple occurrences", () => {
			expect(escapeJSDoc("*/ and */")).toBe("*\\/ and *\\/");
		});

		it("should not affect other content", () => {
			expect(escapeJSDoc("normal /* content")).toBe("normal /* content");
		});
	});

	describe("wrapNullable", () => {
		it("should add .nullable() when isNullable is true", () => {
			expect(wrapNullable("z.string()", true)).toBe("z.string().nullable()");
		});

		it("should not modify when isNullable is false", () => {
			expect(wrapNullable("z.string()", false)).toBe("z.string()");
		});

		it("should work with complex validations", () => {
			expect(wrapNullable("z.string().min(5).max(10)", true)).toBe("z.string().min(5).max(10).nullable()");
		});
	});

	describe("isNullable", () => {
		it("should return true for OpenAPI 3.0 nullable: true", () => {
			const schema: OpenAPISchema = {
				type: "string",
				nullable: true,
			};
			expect(isNullable(schema)).toBe(true);
		});

		it("should return false for nullable: false", () => {
			const schema: OpenAPISchema = {
				type: "string",
				nullable: false,
			};
			expect(isNullable(schema)).toBe(false);
		});

		it("should return true for OpenAPI 3.1 type array with null", () => {
			const schema: OpenAPISchema = {
				type: ["string", "null"],
			};
			expect(isNullable(schema)).toBe(true);
		});

		it("should return false for type array without null", () => {
			const schema: OpenAPISchema = {
				type: ["string", "number"],
			};
			expect(isNullable(schema)).toBe(false);
		});

		it("should return false for simple type", () => {
			const schema: OpenAPISchema = {
				type: "string",
			};
			expect(isNullable(schema)).toBe(false);
		});
	});

	describe("getPrimaryType", () => {
		it("should return type for simple schema", () => {
			const schema: OpenAPISchema = { type: "string" };
			expect(getPrimaryType(schema)).toBe("string");
		});

		it("should return first non-null type from array", () => {
			const schema: OpenAPISchema = { type: ["null", "string"] };
			expect(getPrimaryType(schema)).toBe("string");
		});

		it("should return first type when no null", () => {
			const schema: OpenAPISchema = { type: ["string", "number"] };
			expect(getPrimaryType(schema)).toBe("string");
		});

		it("should return undefined for schema without type", () => {
			const schema: OpenAPISchema = {};
			expect(getPrimaryType(schema)).toBeUndefined();
		});
	});

	describe("hasMultipleTypes", () => {
		it("should return false for single type", () => {
			const schema: OpenAPISchema = { type: "string" };
			expect(hasMultipleTypes(schema)).toBe(false);
		});

		it("should return false for single type with null", () => {
			const schema: OpenAPISchema = { type: ["string", "null"] };
			expect(hasMultipleTypes(schema)).toBe(false);
		});

		it("should return true for multiple non-null types", () => {
			const schema: OpenAPISchema = { type: ["string", "number"] };
			expect(hasMultipleTypes(schema)).toBe(true);
		});

		it("should return true for multiple types with null", () => {
			const schema: OpenAPISchema = { type: ["string", "number", "null"] };
			expect(hasMultipleTypes(schema)).toBe(true);
		});

		it("should return false for schema without type", () => {
			const schema: OpenAPISchema = {};
			expect(hasMultipleTypes(schema)).toBe(false);
		});
	});

	describe("addDescription", () => {
		it("should add .describe() when useDescribe is true and description exists", () => {
			const result = addDescription("z.string()", "A test string", true);
			expect(result).toBe('z.string().describe("A test string")');
		});

		it("should not add .describe() when useDescribe is false", () => {
			const result = addDescription("z.string()", "A test string", false);
			expect(result).toBe("z.string()");
		});

		it("should not add .describe() when description is undefined", () => {
			const result = addDescription("z.string()", undefined, true);
			expect(result).toBe("z.string()");
		});

		it("should escape description content", () => {
			const result = addDescription("z.string()", 'Quote "this"', true);
			expect(result).toBe('z.string().describe("Quote \\"this\\"")');
		});

		it("should handle multiline descriptions", () => {
			const result = addDescription("z.string()", "Line 1\nLine 2", true);
			expect(result).toBe('z.string().describe("Line 1\\nLine 2")');
		});
	});
});
