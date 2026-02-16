import { describe, expect, it } from "vitest";

import type { OpenAPISchema } from "../src/types";
import { escapeJSDoc, getPrimaryType, hasMultipleTypes, isNullable } from "../src/utils/string-utils";

describe("string-utils", () => {
	describe("escapeJSDoc", () => {
		it("should escape closing comment markers", () => {
			expect(escapeJSDoc("This is a */ comment")).toBe("This is a *\\/ comment");
		});

		it("should handle multiple occurrences", () => {
			expect(escapeJSDoc("First */ and second */")).toBe("First *\\/ and second *\\/");
		});

		it("should leave normal text unchanged", () => {
			expect(escapeJSDoc("Normal description")).toBe("Normal description");
		});

		it("should handle empty string", () => {
			expect(escapeJSDoc("")).toBe("");
		});
	});

	describe("isNullable", () => {
		it("should return true when nullable is true (OpenAPI 3.0)", () => {
			const schema: OpenAPISchema = { type: "string", nullable: true };
			expect(isNullable(schema)).toBe(true);
		});

		it("should return false when nullable is false", () => {
			const schema: OpenAPISchema = { type: "string", nullable: false };
			expect(isNullable(schema)).toBe(false);
		});

		it("should return true when type includes null (OpenAPI 3.1)", () => {
			const schema: OpenAPISchema = { type: ["string", "null"] };
			expect(isNullable(schema)).toBe(true);
		});

		it("should return false when type array does not include null", () => {
			const schema: OpenAPISchema = { type: ["string", "integer"] };
			expect(isNullable(schema)).toBe(false);
		});

		it("should return default value when not explicitly specified", () => {
			const schema: OpenAPISchema = { type: "string" };
			expect(isNullable(schema)).toBe(false);
			expect(isNullable(schema, true)).toBe(true);
		});
	});

	describe("getPrimaryType", () => {
		it("should return type when it is a string", () => {
			const schema: OpenAPISchema = { type: "string" };
			expect(getPrimaryType(schema)).toBe("string");
		});

		it("should return first non-null type from array", () => {
			const schema: OpenAPISchema = { type: ["null", "string"] };
			expect(getPrimaryType(schema)).toBe("string");
		});

		it("should return first non-null type when null is not first", () => {
			const schema: OpenAPISchema = { type: ["string", "null"] };
			expect(getPrimaryType(schema)).toBe("string");
		});

		it("should return undefined when type is not set", () => {
			const schema: OpenAPISchema = {};
			expect(getPrimaryType(schema)).toBeUndefined();
		});

		it("should return undefined when all types are null", () => {
			const schema: OpenAPISchema = { type: ["null"] };
			expect(getPrimaryType(schema)).toBeUndefined();
		});
	});

	describe("hasMultipleTypes", () => {
		it("should return false for single type string", () => {
			const schema: OpenAPISchema = { type: "string" };
			expect(hasMultipleTypes(schema)).toBe(false);
		});

		it("should return false for type array with one non-null type", () => {
			const schema: OpenAPISchema = { type: ["string", "null"] };
			expect(hasMultipleTypes(schema)).toBe(false);
		});

		it("should return true for type array with multiple non-null types", () => {
			const schema: OpenAPISchema = { type: ["string", "integer"] };
			expect(hasMultipleTypes(schema)).toBe(true);
		});

		it("should return true for type array with multiple types including null", () => {
			const schema: OpenAPISchema = { type: ["string", "integer", "null"] };
			expect(hasMultipleTypes(schema)).toBe(true);
		});

		it("should return false when no type specified", () => {
			const schema: OpenAPISchema = {};
			expect(hasMultipleTypes(schema)).toBe(false);
		});
	});
});
