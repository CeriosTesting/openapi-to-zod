import { describe, expect, it } from "vitest";

import { generateEnum } from "../src/generators/enum-generator.js";

describe("Enum Generator", () => {
	describe("generateEnum with 'enum' format", () => {
		it("should generate a TypeScript enum from string values", () => {
			const result = generateEnum("Status", ["active", "inactive", "pending"], {
				format: "enum",
			});
			expect(result.code).toContain("export enum Status {");
			expect(result.code).toContain('Active = "active"');
			expect(result.code).toContain('Inactive = "inactive"');
			expect(result.code).toContain('Pending = "pending"');
			expect(result.typeName).toBe("Status");
		});

		it("should handle numeric enum values", () => {
			const result = generateEnum("Priority", [0, 1, 2, 3], {
				format: "enum",
			});
			expect(result.code).toContain("export enum Priority {");
			expect(result.code).toContain("Value0 = 0");
			expect(result.code).toContain("Value1 = 1");
			expect(result.code).toContain("Value2 = 2");
			expect(result.code).toContain("Value3 = 3");
		});

		it("should convert enum member names to PascalCase", () => {
			const result = generateEnum("HttpMethod", ["GET", "POST", "PUT", "DELETE"], {
				format: "enum",
			});
			expect(result.code).toContain('Get = "GET"');
			expect(result.code).toContain('Post = "POST"');
			expect(result.code).toContain('Put = "PUT"');
			expect(result.code).toContain('Delete = "DELETE"');
		});

		it("should handle enum values with special characters", () => {
			const result = generateEnum("SpecialEnum", ["foo-bar", "hello_world", "test.value"], { format: "enum" });
			expect(result.code).toContain('FooBar = "foo-bar"');
			expect(result.code).toContain('HelloWorld = "hello_world"');
			expect(result.code).toContain('TestValue = "test.value"');
		});

		it("should apply prefix to enum name", () => {
			const result = generateEnum("Status", ["active", "inactive"], {
				format: "enum",
				prefix: "Api",
			});
			expect(result.typeName).toBe("ApiStatus");
			expect(result.code).toContain("export enum ApiStatus {");
		});

		it("should apply suffix to enum name", () => {
			const result = generateEnum("Status", ["active", "inactive"], {
				format: "enum",
				suffix: "Type",
			});
			expect(result.typeName).toBe("StatusType");
			expect(result.code).toContain("export enum StatusType {");
		});

		it("should apply both prefix and suffix", () => {
			const result = generateEnum("Status", ["active", "inactive"], {
				format: "enum",
				prefix: "Api",
				suffix: "Enum",
			});
			expect(result.typeName).toBe("ApiStatusEnum");
			expect(result.code).toContain("export enum ApiStatusEnum {");
		});

		it("should handle empty enum", () => {
			const result = generateEnum("EmptyEnum", [], { format: "enum" });
			expect(result.code).toContain("export enum EmptyEnum {");
			expect(result.code).toContain("}");
		});

		it("should handle single value enum", () => {
			const result = generateEnum("SingleValue", ["only"], { format: "enum" });
			expect(result.code).toContain("export enum SingleValue {");
			expect(result.code).toContain('Only = "only"');
		});

		it("should fall back to union for boolean enums", () => {
			const result = generateEnum("BooleanEnum", [true, false], {
				format: "enum",
			});
			// Boolean enums can't use TS enum, should fall back to union
			expect(result.code).toContain("export type BooleanEnum =");
		});
	});

	describe("generateEnum with 'union' format", () => {
		it("should generate a union type from string values", () => {
			const result = generateEnum("Status", ["active", "inactive", "pending"], {
				format: "union",
			});
			expect(result.code).toContain("export type Status =");
			expect(result.code).toContain('"active"');
			expect(result.code).toContain('"inactive"');
			expect(result.code).toContain('"pending"');
			expect(result.code).toContain("|");
		});

		it("should handle numeric values", () => {
			const result = generateEnum("Priority", [1, 2, 3], { format: "union" });
			expect(result.code).toContain("export type Priority =");
			expect(result.code).toContain("1");
			expect(result.code).toContain("2");
			expect(result.code).toContain("3");
		});

		it("should handle boolean values", () => {
			const result = generateEnum("BooleanUnion", [true, false], {
				format: "union",
			});
			expect(result.code).toContain("true");
			expect(result.code).toContain("false");
		});

		it("should handle single value union", () => {
			const result = generateEnum("Single", ["only"], { format: "union" });
			expect(result.code).toContain("export type Single =");
			expect(result.code).toContain('"only"');
		});

		it("should apply prefix and suffix", () => {
			const result = generateEnum("Status", ["active"], {
				format: "union",
				prefix: "Api",
				suffix: "Type",
			});
			expect(result.typeName).toBe("ApiStatusType");
		});
	});

	describe("generateEnum with 'const-object' format", () => {
		it("should generate a const object from string values", () => {
			const result = generateEnum("Status", ["active", "inactive"], {
				format: "const-object",
			});
			expect(result.code).toContain("export const Status = {");
			expect(result.code).toContain('Active: "active"');
			expect(result.code).toContain('Inactive: "inactive"');
			expect(result.code).toContain("} as const;");
			expect(result.code).toContain("export type Status = (typeof Status)[keyof typeof Status];");
		});

		it("should handle numeric values", () => {
			const result = generateEnum("Priority", [1, 2, 3], {
				format: "const-object",
			});
			expect(result.code).toContain("export const Priority = {");
			expect(result.code).toContain("Value1: 1");
			expect(result.code).toContain("Value2: 2");
			expect(result.code).toContain("Value3: 3");
		});

		it("should handle special characters in values", () => {
			const result = generateEnum("Methods", ["GET", "POST", "PUT", "DELETE"], {
				format: "const-object",
			});
			expect(result.code).toContain('Get: "GET"');
			expect(result.code).toContain('Post: "POST"');
			expect(result.code).toContain('Put: "PUT"');
			expect(result.code).toContain('Delete: "DELETE"');
		});

		it("should apply prefix and suffix", () => {
			const result = generateEnum("Status", ["active"], {
				format: "const-object",
				prefix: "Api",
				suffix: "Values",
			});
			expect(result.typeName).toBe("ApiStatusValues");
			expect(result.code).toContain("export const ApiStatusValues = {");
		});
	});

	describe("duplicate enum key handling", () => {
		describe("sort option prefixes", () => {
			it("should handle ascending/descending sort options with enum format", () => {
				const result = generateEnum("SortOptions", ["externalKey", "-externalKey", "name", "-name", "code", "-code"], {
					format: "enum",
				});
				expect(result.code).toContain('Externalkey = "externalKey"');
				expect(result.code).toContain('ExternalkeyDesc = "-externalKey"');
				expect(result.code).toContain('Name = "name"');
				expect(result.code).toContain('NameDesc = "-name"');
				expect(result.code).toContain('Code = "code"');
				expect(result.code).toContain('CodeDesc = "-code"');
			});

			it("should handle + prefix for ascending sort", () => {
				const result = generateEnum("SortOptions", ["date", "+date", "-date"], { format: "enum" });
				expect(result.code).toContain('Date = "date"');
				expect(result.code).toContain('DateAsc = "+date"');
				expect(result.code).toContain('DateDesc = "-date"');
			});

			it("should handle just - and + as values", () => {
				const result = generateEnum("Operators", ["-", "+"], { format: "enum" });
				expect(result.code).toContain('Desc = "-"');
				expect(result.code).toContain('Asc = "+"');
			});

			it("should handle sort options with const-object format", () => {
				const result = generateEnum("SortOptions", ["externalKey", "-externalKey"], { format: "const-object" });
				expect(result.code).toContain('Externalkey: "externalKey"');
				expect(result.code).toContain('ExternalkeyDesc: "-externalKey"');
			});
		});

		describe("collision deduplication", () => {
			it("should deduplicate colliding enum keys by appending numeric suffix", () => {
				const result = generateEnum("Collisions", ["foo_bar", "foo-bar", "foo bar"], { format: "enum" });
				expect(result.code).toContain('FooBar = "foo_bar"');
				expect(result.code).toContain('FooBar2 = "foo-bar"');
				expect(result.code).toContain('FooBar3 = "foo bar"');
			});

			it("should deduplicate case-insensitive collisions", () => {
				const result = generateEnum("CaseCollisions", ["test", "TEST", "Test"], { format: "enum" });
				expect(result.code).toContain('Test = "test"');
				expect(result.code).toContain('Test2 = "TEST"');
				expect(result.code).toContain('Test3 = "Test"');
			});

			it("should deduplicate collisions with const-object format", () => {
				const result = generateEnum("Collisions", ["foo_bar", "foo-bar"], { format: "const-object" });
				expect(result.code).toContain('FooBar: "foo_bar"');
				expect(result.code).toContain('FooBar2: "foo-bar"');
			});
		});

		describe("numeric values with prefixes", () => {
			it("should handle numeric values with +/- string prefixes", () => {
				const result = generateEnum("NumericSort", [5, -5], { format: "enum" });
				expect(result.code).toContain("Value5 = 5");
				expect(result.code).toContain("ValueNeg5 = -5");
			});
		});
	});

	describe("nullable option", () => {
		describe("with union format", () => {
			it("should add | null to union type", () => {
				const result = generateEnum("Status", ["active", "inactive"], {
					format: "union",
					nullable: true,
				});
				expect(result.code).toBe('export type Status = "active" | "inactive" | null;');
			});

			it("should not add | null when nullable is false", () => {
				const result = generateEnum("Status", ["active", "inactive"], {
					format: "union",
					nullable: false,
				});
				expect(result.code).toBe('export type Status = "active" | "inactive";');
				expect(result.code).not.toContain("| null");
			});

			it("should handle single value union with nullable", () => {
				const result = generateEnum("Single", ["only"], {
					format: "union",
					nullable: true,
				});
				expect(result.code).toBe('export type Single = "only" | null;');
			});
		});

		describe("with const-object format", () => {
			it("should add | null to const-object type extraction", () => {
				const result = generateEnum("Status", ["active", "inactive"], {
					format: "const-object",
					nullable: true,
				});
				expect(result.code).toContain("export const Status = {");
				expect(result.code).toContain('Active: "active"');
				expect(result.code).toContain("export type Status = (typeof Status)[keyof typeof Status] | null;");
			});

			it("should not add | null when nullable is false", () => {
				const result = generateEnum("Status", ["active", "inactive"], {
					format: "const-object",
					nullable: false,
				});
				expect(result.code).toContain("export type Status = (typeof Status)[keyof typeof Status];");
				expect(result.code).not.toContain("| null");
			});
		});

		describe("with enum format", () => {
			it("should add a nullable type alias for TypeScript enums", () => {
				const result = generateEnum("Status", ["active", "inactive"], {
					format: "enum",
					nullable: true,
				});
				// TypeScript enums can't include null directly, so we add a type alias
				expect(result.code).toContain("export enum Status {");
				expect(result.code).toContain('Active = "active"');
				expect(result.code).toContain("export type StatusNullable = Status | null;");
			});

			it("should not add nullable type alias when nullable is false", () => {
				const result = generateEnum("Status", ["active", "inactive"], {
					format: "enum",
					nullable: false,
				});
				expect(result.code).toContain("export enum Status {");
				expect(result.code).not.toContain("StatusNullable");
				expect(result.code).not.toContain("| null");
			});

			it("should handle nullable enum with prefix and suffix", () => {
				const result = generateEnum("Status", ["active", "inactive"], {
					format: "enum",
					nullable: true,
					prefix: "Api",
					suffix: "Enum",
				});
				expect(result.code).toContain("export enum ApiStatusEnum {");
				expect(result.code).toContain("export type ApiStatusEnumNullable = ApiStatusEnum | null;");
			});

			it("should include JSDoc comment for nullable type alias", () => {
				const result = generateEnum("Status", ["active"], {
					format: "enum",
					nullable: true,
				});
				expect(result.code).toContain("/** Nullable version of Status enum */");
			});
		});

		describe("with boolean enums (fallback to union)", () => {
			it("should handle nullable boolean enum", () => {
				const result = generateEnum("BooleanEnum", [true, false], {
					format: "enum",
					nullable: true,
				});
				// Boolean enums fall back to union format
				expect(result.code).toContain("export type BooleanEnum =");
				expect(result.code).toContain("true");
				expect(result.code).toContain("false");
				expect(result.code).toContain("| null");
			});
		});
	});
});
