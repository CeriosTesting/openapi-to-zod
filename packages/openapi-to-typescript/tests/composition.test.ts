import { describe, expect, it } from "vitest";

import { TestUtils } from "./utils/test-utils.js";

describe("Composition Types", () => {
	describe("AllOf (Intersection Types)", () => {
		it("should generate intersection type for allOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("export type Employee =");
			expect(output).toContain("&");
		});

		it("should reference all constituent types", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("BaseEntity");
			expect(output).toContain("PersonBase");
		});

		it("should generate base types", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("export type BaseEntity = {");
			expect(output).toContain("export type PersonBase = {");
		});

		it("should include inline properties in allOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			// Employee has inline properties: employeeId, department, salary
			expect(output).toContain("employeeId");
			expect(output).toContain("department");
		});
	});

	describe("OneOf (Union Types)", () => {
		it("should generate union type for oneOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("export type Pet =");
			expect(output).toMatch(/Cat\s*\|\s*Dog/);
		});

		it("should generate constituent types", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("Cat");
			expect(output).toContain("Dog");
		});

		it("should handle discriminated unions", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("PetWithDiscriminator");
			expect(output).toContain("CatWithType");
			expect(output).toContain("DogWithType");
		});
	});

	describe("AnyOf (Union Types)", () => {
		it("should generate union type for anyOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("NullableString");
		});

		it("should handle nullable types via anyOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toMatch(/string\s*\|\s*null/);
		});

		it("should handle complex anyOf unions", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("ComplexUnion");
		});
	});

	describe("Nested Composition", () => {
		it("should handle types that combine allOf and other compositions", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			// Employee uses allOf with multiple refs and inline object
			expect(output).toContain("Employee");
			expect(output).toContain("BaseEntity");
			expect(output).toContain("PersonBase");
		});
	});

	describe("Reference Resolution in Composition", () => {
		it("should resolve all referenced types", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			// All referenced types should be present
			expect(output).toContain("BaseEntity");
			expect(output).toContain("PersonBase");
			expect(output).toContain("Cat");
			expect(output).toContain("Dog");
		});

		it("should generate complete types for references", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			// BaseEntity should have its properties
			expect(output).toContain("id:");
			expect(output).toContain("createdAt");
			expect(output).toContain("updatedAt");
		});
	});

	describe("AllOf with type: object", () => {
		it("should generate intersection type when schema has both type: object and allOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			// ParentBillableResource has type: object AND allOf with a $ref
			// Should generate: export type ParentBillableResource = BaseEntity;
			expect(output).toContain("export type ParentBillableResource =");
			expect(output).toContain("BaseEntity");
			// Should NOT generate empty object like { ; }
			expect(output).not.toMatch(/ParentBillableResource\s*=\s*\{\s*;\s*\}/);
		});

		it("should include description when type: object combined with allOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("The parent billable resource");
		});

		it("should handle multiple refs with type: object and allOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			// ExtendedPerson has type: object AND allOf with multiple $refs
			expect(output).toContain("export type ExtendedPerson =");
			expect(output).toMatch(/PersonBase\s*&\s*BaseEntity|BaseEntity\s*&\s*PersonBase/);
		});
	});
});
