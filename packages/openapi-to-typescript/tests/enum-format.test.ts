import { describe, expect, it } from "vitest";

import { TestUtils } from "./utils/test-utils.js";

describe("Enum Format Options", () => {
	describe("Union Type Format (default)", () => {
		it("should generate union types by default", () => {
			const output = TestUtils.generateFromFixture("enums.yaml");
			expect(output).toContain("export type StringEnum =");
			expect(output).toContain("export type Priority =");
			expect(output).toContain("export type HttpMethod =");
		});

		it("should generate string literals in union by default", () => {
			const output = TestUtils.generateFromFixture("enums.yaml");
			expect(output).toContain('"active"');
			expect(output).toContain('"inactive"');
			expect(output).toContain('"pending"');
		});

		it("should handle uppercase enum values in union", () => {
			const output = TestUtils.generateFromFixture("enums.yaml");
			expect(output).toContain('"GET"');
			expect(output).toContain('"POST"');
			expect(output).toContain('"PUT"');
			expect(output).toContain('"DELETE"');
		});

		it("should handle priority enum values in union", () => {
			const output = TestUtils.generateFromFixture("enums.yaml");
			expect(output).toContain('"low"');
			expect(output).toContain('"medium"');
			expect(output).toContain('"high"');
			expect(output).toContain('"critical"');
		});
	});

	describe("TypeScript Enum Format", () => {
		it("should generate TypeScript enums when enumFormat is 'enum'", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "enum",
			});
			expect(output).toContain("export enum StringEnum");
			expect(output).toContain("export enum Priority");
			expect(output).toContain("export enum HttpMethod");
		});

		it("should generate proper enum member names", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "enum",
			});
			expect(output).toContain('Active = "active"');
			expect(output).toContain('Inactive = "inactive"');
			expect(output).toContain('Pending = "pending"');
		});

		it("should handle uppercase enum values", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "enum",
			});
			expect(output).toContain('Get = "GET"');
			expect(output).toContain('Post = "POST"');
			expect(output).toContain('Put = "PUT"');
			expect(output).toContain('Delete = "DELETE"');
		});

		it("should handle priority enum values", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "enum",
			});
			expect(output).toContain('Low = "low"');
			expect(output).toContain('Medium = "medium"');
			expect(output).toContain('High = "high"');
			expect(output).toContain('Critical = "critical"');
		});
	});

	describe("Const Object Format", () => {
		it("should generate const objects when enumFormat is 'const-object'", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "const-object",
			});
			expect(output).toContain("export const StringEnum = {");
			expect(output).toContain("} as const;");
		});

		it("should generate corresponding type", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "const-object",
			});
			expect(output).toContain("export type StringEnum = (typeof StringEnum)[keyof typeof StringEnum];");
		});

		it("should generate proper object properties", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "const-object",
			});
			expect(output).toContain('Active: "active"');
			expect(output).toContain('Inactive: "inactive"');
			expect(output).toContain('Pending: "pending"');
		});

		it("should handle HTTP method enum as const object", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "const-object",
			});
			expect(output).toContain("export const HttpMethod = {");
			expect(output).toContain('Get: "GET"');
			expect(output).toContain('Post: "POST"');
		});
	});

	describe("Enum References in Objects", () => {
		it("should reference enum types correctly", () => {
			const output = TestUtils.generateFromFixture("enums.yaml");
			expect(output).toContain("ModelWithEnums");
			expect(output).toContain("status: StringEnum");
		});

		it("should reference union types correctly", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "union",
			});
			expect(output).toContain("status: StringEnum");
		});

		it("should reference const object types correctly", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "const-object",
			});
			expect(output).toContain("status: StringEnum");
		});
	});

	describe("Numeric Enums", () => {
		it("should handle numeric enum values", () => {
			const output = TestUtils.generateFromFixture("enums.yaml");
			expect(output).toContain("NumericEnum");
		});

		it("should generate numeric values in union format", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "union",
			});
			expect(output).toContain("export type NumericEnum =");
		});
	});
});
