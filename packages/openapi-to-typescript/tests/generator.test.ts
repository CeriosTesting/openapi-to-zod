import { describe, expect, it } from "vitest";
import { TypeScriptGenerator } from "../src/typescript-generator.js";
import { TestUtils } from "./utils/test-utils.js";

describe("TypeScriptGenerator", () => {
	const simpleFixture = TestUtils.getFixturePath("simple.yaml");

	describe("Basic Generation", () => {
		it("should generate TypeScript from a simple schema", () => {
			const output = TestUtils.generateFromFixture("simple.yaml");
			expect(output).toBeDefined();
			expect(output.length).toBeGreaterThan(0);
		});

		it("should generate User type", () => {
			const output = TestUtils.generateFromFixture("simple.yaml");
			expect(output).toContain("export type User");
			expect(output).toContain("id: string");
			expect(output).toContain("name: string");
		});

		it("should handle optional properties", () => {
			const output = TestUtils.generateFromFixture("simple.yaml");
			// email, age, isActive are optional in User
			expect(output).toContain("email?: string");
			expect(output).toContain("age?: number");
			expect(output).toContain("isActive?: boolean");
		});

		it("should generate Address type", () => {
			const output = TestUtils.generateFromFixture("simple.yaml");
			expect(output).toContain("export type Address");
			expect(output).toContain("street: string");
			expect(output).toContain("city: string");
			expect(output).toContain("postalCode?: string");
		});

		it("should generate Company with references", () => {
			const output = TestUtils.generateFromFixture("simple.yaml");
			expect(output).toContain("export type Company");
			expect(output).toContain("address?: Address");
			expect(output).toContain("employees?: User[]");
		});
	});

	describe("Object Format Options", () => {
		it("should generate type aliases by default", () => {
			const output = TestUtils.generateFromFixture("simple.yaml");
			expect(output).toContain("export type User");
			expect(output).toContain("export type Address");
		});
	});

	describe("Enum Generation", () => {
		it("should generate union types by default", () => {
			const output = TestUtils.generateFromFixture("enums.yaml");
			expect(output).toContain("export type StringEnum =");
			expect(output).toContain('"active"');
			expect(output).toContain('"inactive"');
			expect(output).toContain('"pending"');
		});

		it("should generate TypeScript enums when enumFormat is 'enum'", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "enum",
			});
			expect(output).toContain("export enum StringEnum");
			expect(output).toContain('Active = "active"');
			expect(output).toContain('Inactive = "inactive"');
			expect(output).not.toContain("export type StringEnum =");
		});

		it("should generate const objects when enumFormat is 'const-object'", () => {
			const output = TestUtils.generateFromFixture("enums.yaml", {
				enumFormat: "const-object",
			});
			expect(output).toContain("export const StringEnum = {");
			expect(output).toContain('Active: "active"');
			expect(output).toContain("} as const");
			expect(output).toContain("export type StringEnum = (typeof StringEnum)[keyof typeof StringEnum]");
		});

		it("should generate HTTP method union type", () => {
			const output = TestUtils.generateFromFixture("enums.yaml");
			expect(output).toContain("export type HttpMethod =");
			expect(output).toContain('"GET"');
			expect(output).toContain('"POST"');
		});
	});

	describe("Type Aliases", () => {
		it("should generate type aliases for primitive types", () => {
			const output = TestUtils.generateFromFixture("types.yaml");
			expect(output).toContain("export type StringType = string");
			expect(output).toContain("export type NumberType = number");
			expect(output).toContain("export type IntegerType = number");
			expect(output).toContain("export type BooleanType = boolean");
		});

		it("should generate array types", () => {
			const output = TestUtils.generateFromFixture("types.yaml");
			expect(output).toContain("export type ArrayType = string[]");
		});

		it("should handle nullable types", () => {
			const output = TestUtils.generateFromFixture("types.yaml");
			// NullableType is defined with nullable: true
			expect(output).toContain("NullableType");
		});
	});

	describe("Composition - AllOf", () => {
		it("should generate intersection types for allOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("export type Employee =");
			expect(output).toContain("BaseEntity");
			expect(output).toContain("PersonBase");
		});

		it("should generate base types", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("export type BaseEntity");
			expect(output).toContain("export type PersonBase");
		});
	});

	describe("Composition - OneOf/AnyOf", () => {
		it("should generate union types for oneOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("export type Pet =");
			expect(output).toMatch(/Cat\s*\|\s*Dog/);
		});

		it("should generate union types for anyOf", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("export type NullableString =");
			expect(output).toMatch(/string\s*\|\s*null/);
		});

		it("should handle discriminated unions", () => {
			const output = TestUtils.generateFromFixture("composition.yaml");
			expect(output).toContain("export type PetWithDiscriminator =");
		});
	});

	describe("Additional Properties", () => {
		it("should handle additionalProperties: true", () => {
			const output = TestUtils.generateFromFixture("types.yaml");
			// Schema with additionalProperties: true
			expect(output).toContain("AdditionalPropsAny");
		});

		it("should handle typed additionalProperties", () => {
			const output = TestUtils.generateFromFixture("types.yaml");
			// Schema with additionalProperties: { type: string }
			expect(output).toContain("AdditionalPropsTyped");
		});
	});

	describe("Naming Options", () => {
		it("should add prefix to schema names", () => {
			const output = TestUtils.generateFromFixture("simple.yaml", {
				prefix: "Api",
			});
			expect(output).toContain("export type ApiUser");
			expect(output).toContain("export type ApiAddress");
		});

		it("should add suffix to schema names", () => {
			const output = TestUtils.generateFromFixture("simple.yaml", {
				suffix: "Dto",
			});
			expect(output).toContain("export type UserDto");
			expect(output).toContain("export type AddressDto");
		});

		it("should add both prefix and suffix", () => {
			const output = TestUtils.generateFromFixture("simple.yaml", {
				prefix: "Api",
				suffix: "Response",
			});
			expect(output).toContain("export type ApiUserResponse");
			expect(output).toContain("export type ApiAddressResponse");
		});

		it("should strip prefix from schema names", () => {
			const generator = new TypeScriptGenerator({
				input: simpleFixture,
				outputTypes: "output.ts",
				stripSchemaPrefix: "Schema",
			});
			const output = generator.generateString();
			// User schema doesn't have Schema prefix, so should remain User
			expect(output).toContain("User");
		});
	});

	describe("Documentation", () => {
		it("should include JSDoc comments when includeDescriptions is true (default)", () => {
			const output = TestUtils.generateFromFixture("simple.yaml", {
				includeDescriptions: true,
			});
			expect(output).toContain("/**");
			expect(output).toContain("* A user in the system");
			expect(output).toContain("*/");
		});

		it("should not include JSDoc comments when includeDescriptions is false", () => {
			const output = TestUtils.generateFromFixture("simple.yaml", {
				includeDescriptions: false,
			});
			// Note: header statistics block may still contain '/**'
			expect(output).not.toContain("* A user in the system");
		});
	});

	describe("Header Options", () => {
		it("should include default header (always included)", () => {
			const output = TestUtils.generateFromFixture("simple.yaml");
			expect(output).toContain("// Auto-generated by @cerios/openapi-to-typescript");
			expect(output).toContain("// Do not edit this file manually");
		});

		it("should include statistics block when showStats is true (default)", () => {
			const output = TestUtils.generateFromFixture("simple.yaml", {
				showStats: true,
			});
			expect(output).toContain("TypeScript Types Generation Statistics");
			expect(output).toContain("Total schemas:");
		});

		it("should not include statistics when showStats is false", () => {
			const output = TestUtils.generateFromFixture("simple.yaml", {
				showStats: false,
			});
			expect(output).not.toContain("TypeScript Types Generation Statistics");
		});
	});

	describe("Error Handling", () => {
		it("should throw error for non-existent file", () => {
			expect(() => {
				const generator = new TypeScriptGenerator({
					input: "/non/existent/file.yaml",
					outputTypes: "output.ts",
				});
				generator.generateString();
			}).toThrow();
		});
	});

	describe("Reference Resolution", () => {
		it("should resolve $ref references correctly", () => {
			const output = TestUtils.generateFromFixture("simple.yaml");
			// Company has $ref to Address and User
			expect(output).toContain("address?: Address");
			expect(output).toContain("employees?: User[]");
		});
	});

	describe("Format Strings", () => {
		it("should treat all string formats as string type", () => {
			const output = TestUtils.generateFromFixture("types.yaml");
			// All format types should be string in TypeScript
			expect(output).toContain("uuid?: string");
			expect(output).toContain("date?: string");
			expect(output).toContain("dateTime?: string");
			expect(output).toContain("email?: string");
			expect(output).toContain("uri?: string");
		});

		it("should generate number for integer formats", () => {
			const output = TestUtils.generateFromFixture("types.yaml");
			expect(output).toContain("int32?: number");
			expect(output).toContain("int64?: number");
		});

		it("should generate number for float/double formats", () => {
			const output = TestUtils.generateFromFixture("types.yaml");
			expect(output).toContain("float?: number");
			expect(output).toContain("double?: number");
		});
	});

	describe("Operation Naming", () => {
		it("should use operationId for operation-derived types by default", () => {
			const output = TestUtils.generateFromCoreFixture("operations", "parameters.yaml");

			expect(output).toContain("export type GetUserQueryParams");
			expect(output).toContain("export type GetItemsQueryParams");
		});

		it("should use method+path naming when useOperationId is false", () => {
			const output = TestUtils.generateFromCoreFixture("operations", "parameters.yaml", {
				useOperationId: false,
			});

			expect(output).toContain("export type GetUsersByUserIdQueryParams");
			expect(output).toContain("export type GetItemsQueryParams");
			expect(output).not.toContain("export type GetUserQueryParams");
		});
	});
});
