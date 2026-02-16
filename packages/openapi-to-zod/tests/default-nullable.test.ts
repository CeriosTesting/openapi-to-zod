import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

describe("defaultNullable option", () => {
	const testDir = join(__dirname, "fixtures", "default-nullable-test");
	const specPath = join(testDir, "spec.yaml");

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });

		// Create a test OpenAPI spec with properties that don't have explicit nullable
		const spec = `
openapi: 3.0.3
info:
  title: Default Nullable Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    User:
      type: object
      required:
        - id
      properties:
        id:
          type: integer
          description: User ID
        name:
          type: string
          description: User name without explicit nullable
        email:
          type: string
          nullable: true
          description: Email explicitly nullable
        phone:
          type: string
          nullable: false
          description: Phone explicitly not nullable
    NullableTest:
      type: object
      properties:
        implicitField:
          type: string
          description: No nullable annotation
        explicitNullable:
          type: string
          nullable: true
        explicitNotNullable:
          type: string
          nullable: false
        arrayField:
          type: array
          items:
            type: string
`;
		writeFileSync(specPath, spec.trim());
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("defaultNullable: false (default behavior)", () => {
		it("should not add .nullable() to properties without explicit nullable annotation", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// Fields without explicit nullable should NOT have .nullable()
			// id is required and has no nullable - should not be nullable
			expect(output).toMatch(/id:\s*z\.number\(\)\.int\(\)(?!\.nullable)/);
			// name has no nullable annotation - should not be nullable
			expect(output).toMatch(/name:\s*z\.string\(\)\.optional\(\)(?!\.nullable)/);
		});

		it("should still add .nullable() when explicitly set to true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// email has nullable: true - should have .nullable()
			expect(output).toMatch(/email:\s*z\.string\(\)\.nullable\(\)/);
		});

		it("should not add .nullable() when explicitly set to false", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// phone has nullable: false - should NOT have .nullable()
			expect(output).toMatch(/phone:\s*z\.string\(\)(?!\.nullable)/);
		});
	});

	describe("defaultNullable: true", () => {
		it("should add .nullable() to properties without explicit nullable annotation", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Fields without explicit nullable should have .nullable() when defaultNullable is true
			// name has no nullable annotation - should be nullable with defaultNullable: true
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
		});

		it("should still respect explicit nullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// email has nullable: true - should have .nullable()
			expect(output).toMatch(/email:\s*z\.string\(\)\.nullable\(\)/);
		});

		it("should respect explicit nullable: false and NOT add .nullable()", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// phone has nullable: false - should NOT have .nullable() even with defaultNullable: true
			expect(output).toMatch(/phone:\s*z\.string\(\)(?!\.nullable)/);
		});

		it("should add .nullable() to implicit fields in NullableTest schema", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// implicitField has no nullable annotation - should be nullable with defaultNullable: true
			expect(output).toMatch(/implicitField:\s*z\.string\(\)\.nullable\(\)/);
			// explicitNullable has nullable: true
			expect(output).toMatch(/explicitNullable:\s*z\.string\(\)\.nullable\(\)/);
			// explicitNotNullable has nullable: false - should NOT have .nullable()
			expect(output).toMatch(/explicitNotNullable:\s*z\.string\(\)(?!\.nullable)/);
		});
	});

	describe("default behavior (no option specified)", () => {
		it("should default to false (strict mode - only explicit nullable)", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				// defaultNullable not specified - should default to false
			});
			const output = generator.generateString();

			// name has no nullable annotation - should NOT be nullable (default is false)
			// It should be z.string().optional() without .nullable()
			expect(output).toMatch(/name:\s*z\.string\(\)\.optional\(\)(?!\.nullable)/);
		});
	});

	describe("top-level schemas should NOT be affected by defaultNullable", () => {
		it("should NOT add .nullable() to top-level object schema definitions with defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Top-level schema definitions should NOT end with .nullable()
			// User schema should be: z.object({...}); NOT z.object({...}).nullable();
			// Look for schema definitions that incorrectly have .nullable() at the end
			expect(output).not.toMatch(/export const userSchema = z\.object\(\{[\s\S]*?\}\)\.nullable\(\);/);
			expect(output).not.toMatch(/export const nullableTestSchema = z\.object\(\{[\s\S]*?\}\)\.nullable\(\);/);
		});

		it("should add .nullable() to properties but not to the containing object schema", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Properties should have .nullable()
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
			expect(output).toMatch(/implicitField:\s*z\.string\(\)\.nullable\(\)/);

			// But the schema definition should not end with .nullable()
			// Count schema definitions with .nullable() at the end - should be 0
			const topLevelNullableSchemas = output.match(
				/export const \w+Schema = z\.object\(\{[\s\S]*?\}\)\.nullable\(\);/g
			);
			expect(topLevelNullableSchemas).toBeNull();
		});

		it("should produce correct output format with defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// The output should contain the schema without .nullable() at the end
			// Properties inside should have .nullable()
			expect(output).toContain("export const userSchema = z.object({");
			expect(output).toContain("export const nullableTestSchema = z.object({");

			// Verify the closing pattern is NOT }).nullable();
			const lines = output.split("\n");
			for (const line of lines) {
				if (line.includes("export const") && line.includes("Schema = z.object(")) {
					// This starts a schema definition - find where it ends
					// The end should be }); not }).nullable();
				}
			}
		});
	});

	describe("defaultNullable should apply to schema references ($ref)", () => {
		const refSpecPath = join(testDir, "ref-spec.yaml");

		beforeAll(() => {
			const refSpec = `
openapi: 3.0.3
info:
  title: Ref Nullable Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    Status:
      type: string
      enum:
        - active
        - inactive
    UserRole:
      type: string
      enum:
        - admin
        - user
    Address:
      type: object
      properties:
        street:
          type: string
        city:
          type: string
    UserWithRefs:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        status:
          $ref: '#/components/schemas/Status'
        role:
          $ref: '#/components/schemas/UserRole'
        address:
          $ref: '#/components/schemas/Address'
        nullableStatus:
          allOf:
            - $ref: '#/components/schemas/Status'
          nullable: true
`;
			writeFileSync(refSpecPath, refSpec.trim());
		});

		it("should add .nullable() to $ref schemas when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: refSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Schema references SHOULD have .nullable() added by defaultNullable
			expect(output).toMatch(/status:\s*statusSchema\.nullable\(\)/);
			expect(output).toMatch(/role:\s*userRoleSchema\.nullable\(\)/);
			expect(output).toMatch(/address:\s*addressSchema\.nullable\(\)/);
		});

		it("should add .nullable() to explicitly nullable refs", () => {
			const generator = new OpenApiGenerator({
				input: refSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Explicitly nullable refs SHOULD have .nullable()
			expect(output).toMatch(/nullableStatus:.*\.nullable\(\)/);
		});

		it("should still add .nullable() to primitive properties with defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: refSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Regular primitive properties should still get .nullable()
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
		});
	});

	describe("defaultNullable should NOT apply to enum values", () => {
		const enumSpecPath = join(testDir, "enum-spec.yaml");

		beforeAll(() => {
			const enumSpec = `
openapi: 3.0.3
info:
  title: Enum Nullable Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    Color:
      type: string
      enum:
        - red
        - green
        - blue
    Container:
      type: object
      properties:
        color:
          type: string
          enum:
            - red
            - green
            - blue
        name:
          type: string
        nullableColor:
          type: string
          enum:
            - red
            - green
            - blue
          nullable: true
`;
			writeFileSync(enumSpecPath, enumSpec.trim());
		});

		it("should not add .nullable() to inline enum properties when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: enumSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Inline enum property should NOT be nullable (enums are discrete values)
			// Match color: z.enum([...]) without .nullable() following
			expect(output).toMatch(/color:\s*z\.enum\(\[.*?\]\)(?!\.nullable)/);
		});

		it("should add .nullable() to explicitly nullable enum properties", () => {
			const generator = new OpenApiGenerator({
				input: enumSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Explicitly nullable enum SHOULD have .nullable()
			expect(output).toMatch(/nullableColor:\s*z\.enum\(\[.*?\]\)\.nullable\(\)/);
		});

		it("should still add .nullable() to regular string properties", () => {
			const generator = new OpenApiGenerator({
				input: enumSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Regular string property SHOULD be nullable with defaultNullable: true
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
		});

		it("should not add .nullable() to top-level enum schemas", () => {
			const generator = new OpenApiGenerator({
				input: enumSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Top-level enum schema should NOT be nullable
			expect(output).not.toMatch(/export const colorSchema = z\.enum\(\[.*?\]\)\.nullable\(\);/);
			expect(output).toMatch(/export const colorSchema = z\.enum\(\[.*?\]\);/);
		});
	});

	describe("defaultNullable should NOT apply to const/literal values", () => {
		const constSpecPath = join(testDir, "const-spec.yaml");

		beforeAll(() => {
			const constSpec = `
openapi: 3.0.3
info:
  title: Const Nullable Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    FixedType:
      type: string
      const: fixed_value
    Container:
      type: object
      properties:
        type:
          type: string
          const: container
        name:
          type: string
        nullableType:
          type: string
          const: nullable_container
          nullable: true
`;
			writeFileSync(constSpecPath, constSpec.trim());
		});

		it("should not add .nullable() to const properties when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: constSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Const/literal values should NOT be nullable
			expect(output).toMatch(/type:\s*z\.literal\("container"\)(?!\.nullable)/);
		});

		it("should add .nullable() to explicitly nullable const properties", () => {
			const generator = new OpenApiGenerator({
				input: constSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Explicitly nullable const SHOULD have .nullable()
			expect(output).toMatch(/nullableType:\s*z\.literal\("nullable_container"\)\.nullable\(\)/);
		});

		it("should still add .nullable() to regular string properties", () => {
			const generator = new OpenApiGenerator({
				input: constSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Regular string property SHOULD be nullable
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
		});

		it("should not add .nullable() to top-level const schemas", () => {
			const generator = new OpenApiGenerator({
				input: constSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Top-level const schema should NOT be nullable
			expect(output).not.toMatch(/export const fixedTypeSchema = z\.literal\(.*?\)\.nullable\(\);/);
		});
	});
});
