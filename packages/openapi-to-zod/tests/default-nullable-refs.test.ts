import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

/**
 * Tests specifically for defaultNullable behavior with schema references ($ref),
 * enums, and const values.
 *
 * The defaultNullable option applies to property values within objects.
 * It should NOT apply to:
 * - Top-level schema definitions
 * - Enum values
 * - Const/literal values
 *
 * Note: $ref properties DO respect defaultNullable. They will be nullable when
 * defaultNullable: true, unless explicitly marked with nullable: false.
 */
describe("defaultNullable with Schema References", () => {
	const testDir = join(__dirname, "fixtures", "default-nullable-refs-test");

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("$ref properties should respect defaultNullable", () => {
		const specPath = join(testDir, "ref-nullable.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Ref Nullable Test
  version: 1.0.0
paths: {}
components:
  schemas:
    RecoveryReasonEnumOptions:
      type: string
      enum:
        - lost
        - stolen
        - damaged
        - other
    PaymentStatus:
      type: string
      enum:
        - pending
        - completed
        - failed
    ContactInfo:
      type: object
      properties:
        email:
          type: string
        phone:
          type: string
    RecoveryRequest:
      type: object
      properties:
        id:
          type: string
        reason:
          $ref: '#/components/schemas/RecoveryReasonEnumOptions'
        status:
          $ref: '#/components/schemas/PaymentStatus'
        contact:
          $ref: '#/components/schemas/ContactInfo'
        description:
          type: string
        notes:
          type: string
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should add .nullable() to object $ref when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Object $ref SHOULD have .nullable() when defaultNullable: true
			expect(output).toContain("contactInfoSchema.nullable()");
		});

		it("should add .nullable() to enum $ref when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Enum $ref SHOULD have .nullable() when defaultNullable: true
			// (enums at property level respect defaultNullable for $ref)
			expect(output).toContain("recoveryReasonEnumOptionsSchema.nullable()");
			expect(output).toContain("paymentStatusSchema.nullable()");
		});

		it("should add .nullable() to primitive properties when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Regular string properties SHOULD have .nullable()
			expect(output).toMatch(/description:\s*z\.string\(\)\.nullable\(\)/);
			expect(output).toMatch(/notes:\s*z\.string\(\)\.nullable\(\)/);
		});

		it("should not add .nullable() to $ref when defaultNullable: false", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// No references should have .nullable() when defaultNullable is false
			expect(output).not.toContain("recoveryReasonEnumOptionsSchema.nullable()");
			expect(output).not.toContain("paymentStatusSchema.nullable()");
			expect(output).not.toContain("contactInfoSchema.nullable()");
		});

		it("should not add .nullable() to primitive properties when defaultNullable: false", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// Regular string properties should NOT have .nullable() without explicit annotation
			expect(output).not.toMatch(/description:\s*z\.string\(\)\.nullable\(\)/);
			expect(output).not.toMatch(/notes:\s*z\.string\(\)\.nullable\(\)/);
		});
	});

	describe("explicitly nullable $ref should still work", () => {
		const specPath = join(testDir, "explicit-nullable-ref.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Explicit Nullable Ref Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Status:
      type: string
      enum:
        - active
        - inactive
    Address:
      type: object
      properties:
        street:
          type: string
    User:
      type: object
      properties:
        id:
          type: string
        status:
          $ref: '#/components/schemas/Status'
        nullableStatus:
          allOf:
            - $ref: '#/components/schemas/Status'
          nullable: true
        address:
          $ref: '#/components/schemas/Address'
        nullableAddress:
          allOf:
            - $ref: '#/components/schemas/Address'
          nullable: true
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should add .nullable() to all refs when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// All refs should have .nullable() when defaultNullable: true
			expect(output).toMatch(/status:\s*statusSchema\.nullable\(\)/);
			expect(output).toMatch(/address:\s*addressSchema\.nullable\(\)/);

			// Explicitly nullable refs SHOULD also have .nullable()
			expect(output).toMatch(/nullableStatus:.*\.nullable\(\)/);
			expect(output).toMatch(/nullableAddress:.*\.nullable\(\)/);
		});

		it("should add .nullable() only to explicitly nullable refs when defaultNullable: false", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// Non-explicitly-nullable refs should NOT have .nullable() when defaultNullable: false
			expect(output).not.toMatch(/status:\s*statusSchema\.nullable\(\)/);
			expect(output).not.toMatch(/address:\s*addressSchema\.nullable\(\)/);

			// Explicitly nullable refs SHOULD have .nullable()
			expect(output).toMatch(/nullableStatus:.*\.nullable\(\)/);
			expect(output).toMatch(/nullableAddress:.*\.nullable\(\)/);
		});
	});

	describe("$ref properties without allOf wrapper", () => {
		const specPath = join(testDir, "direct-ref.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Direct Ref Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Address:
      type: object
      properties:
        street:
          type: string
        city:
          type: string
    Company:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        mailingAddress:
          $ref: '#/components/schemas/Address'
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should add .nullable() to direct $ref when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Direct $ref should have .nullable() with defaultNullable: true
			expect(output).toMatch(/mailingAddress:\s*addressSchema\.nullable\(\)/);
		});

		it("should NOT add .nullable() to direct $ref when defaultNullable: false", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// Direct $ref should NOT have .nullable() with defaultNullable: false
			expect(output).not.toMatch(/mailingAddress:\s*addressSchema\.nullable\(\)/);
		});
	});

	describe("allOf with explicit nullable: false should override defaultNullable", () => {
		const specPath = join(testDir, "allof-explicit-non-nullable.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: AllOf Explicit Non-Nullable Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Address:
      type: object
      properties:
        street:
          type: string
        city:
          type: string
    Company:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        headquarters:
          allOf:
            - $ref: '#/components/schemas/Address'
          nullable: false
        mailingAddress:
          $ref: '#/components/schemas/Address'
        nullableAddress:
          allOf:
            - $ref: '#/components/schemas/Address'
          nullable: true
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should NOT add .nullable() to allOf with explicit nullable: false when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// headquarters has explicit nullable: false, should NOT have .nullable()
			expect(output).not.toMatch(/headquarters:\s*addressSchema\.nullable\(\)/);
			expect(output).toMatch(/headquarters:\s*addressSchema(?:\.optional\(\))?(?!.*\.nullable)/);

			// mailingAddress has no explicit nullable, should have .nullable() with defaultNullable: true
			expect(output).toMatch(/mailingAddress:\s*addressSchema\.nullable\(\)/);

			// nullableAddress has explicit nullable: true, should have .nullable()
			expect(output).toMatch(/nullableAddress:.*addressSchema\.nullable\(\)/);
		});

		it("should handle nullable correctly when defaultNullable: false", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// headquarters has explicit nullable: false, should NOT have .nullable()
			expect(output).not.toMatch(/headquarters:\s*addressSchema\.nullable\(\)/);

			// mailingAddress has no explicit nullable, should NOT have .nullable() with defaultNullable: false
			expect(output).not.toMatch(/mailingAddress:\s*addressSchema\.nullable\(\)/);

			// nullableAddress has explicit nullable: true, should have .nullable()
			expect(output).toMatch(/nullableAddress:.*addressSchema\.nullable\(\)/);
		});
	});

	describe("circular $ref should respect defaultNullable", () => {
		const specPath = join(testDir, "circular-ref-nullable.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Circular Ref Nullable Test
  version: 1.0.0
paths: {}
components:
  schemas:
    TreeNode:
      type: object
      properties:
        value:
          type: string
        parent:
          $ref: '#/components/schemas/TreeNode'
        children:
          type: array
          items:
            $ref: '#/components/schemas/TreeNode'
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should add .nullable() to circular $ref (z.lazy) when defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Circular refs use z.lazy() and should have .nullable() when defaultNullable: true
			expect(output).toMatch(/parent:\s*z\.lazy\(\(\): z\.ZodTypeAny => treeNodeSchema\)\.nullable\(\)/);

			// Array of circular refs: both the items and the array get .nullable()
			// Items are refs, so they get .nullable(). The array wrapper also gets .nullable().
			expect(output).toMatch(
				/children:\s*z\.array\(z\.lazy\(\(\): z\.ZodTypeAny => treeNodeSchema\)\.nullable\(\)\)\.nullable\(\)/
			);
		});

		it("should NOT add .nullable() to circular $ref when defaultNullable: false", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// Without defaultNullable, circular refs should NOT have .nullable()
			expect(output).toMatch(/parent:\s*z\.lazy\(\(\): z\.ZodTypeAny => treeNodeSchema\)(?!\.nullable)/);

			// Array should also NOT have .nullable()
			expect(output).toMatch(/children:\s*z\.array\(z\.lazy\(\(\): z\.ZodTypeAny => treeNodeSchema\)\)(?!\.nullable)/);
		});
	});

	describe("top-level enum schemas should not be affected by defaultNullable", () => {
		const specPath = join(testDir, "enum-top-level.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Enum Top Level Test
  version: 1.0.0
paths: {}
components:
  schemas:
    ColorEnum:
      type: string
      enum:
        - red
        - green
        - blue
    SizeEnum:
      type: string
      enum:
        - small
        - medium
        - large
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should not make top-level enum schemas nullable with defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Top-level enum exports should NOT have .nullable()
			expect(output).not.toMatch(/export const colorEnumSchema = z\.enum\(\[.*\]\)\.nullable\(\)/);
			expect(output).not.toMatch(/export const sizeEnumSchema = z\.enum\(\[.*\]\)\.nullable\(\)/);
		});
	});

	describe("inline enum properties should not be affected by defaultNullable", () => {
		const specPath = join(testDir, "enum-inline.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Inline Enum Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Product:
      type: object
      properties:
        name:
          type: string
        color:
          type: string
          enum:
            - red
            - green
            - blue
        size:
          type: string
          enum:
            - small
            - medium
            - large
        nullableCategory:
          type: string
          enum:
            - electronics
            - clothing
            - food
          nullable: true
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should not make inline enum properties nullable with defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Inline enum properties should NOT have .nullable() from defaultNullable
			// They should only have .nullable() if explicitly marked
			expect(output).toMatch(/color:\s*z\.enum\(\["red",\s*"green",\s*"blue"\]\)(?!\.nullable)/);
			expect(output).toMatch(/size:\s*z\.enum\(\["small",\s*"medium",\s*"large"\]\)(?!\.nullable)/);

			// But the explicitly nullable one SHOULD have .nullable()
			expect(output).toMatch(/nullableCategory:\s*z\.enum\(\["electronics",\s*"clothing",\s*"food"\]\)\.nullable\(\)/);

			// And the regular string property SHOULD have .nullable()
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
		});
	});

	describe("const/literal values should not be affected by defaultNullable", () => {
		const specPath = join(testDir, "const-literal.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.1.0
info:
  title: Const Literal Test
  version: 1.0.0
paths: {}
components:
  schemas:
    FixedValue:
      type: string
      const: fixed
    TypedObject:
      type: object
      properties:
        type:
          type: string
          const: typed_object
        version:
          type: string
          const: "1.0"
        name:
          type: string
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should not make const/literal values nullable with defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Const/literal values should NOT have .nullable()
			expect(output).not.toMatch(/z\.literal\("fixed"\)\.nullable\(\)/);
			expect(output).not.toMatch(/z\.literal\("typed_object"\)\.nullable\(\)/);
			expect(output).not.toMatch(/z\.literal\("1\.0"\)\.nullable\(\)/);

			// But regular string property SHOULD have .nullable()
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
		});

		it("should not make top-level const schema nullable with defaultNullable: true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Top-level const schema should NOT end with .nullable()
			expect(output).not.toMatch(/export const fixedValueSchema = z\.literal\("fixed"\)\.nullable\(\);/);
		});
	});

	describe("mixed scenario with refs, enums, const, and primitives", () => {
		const specPath = join(testDir, "mixed-scenario.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.1.0
info:
  title: Mixed Scenario Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Status:
      type: string
      enum:
        - active
        - inactive
    Priority:
      type: integer
      enum:
        - 1
        - 2
        - 3
    Config:
      type: object
      properties:
        enabled:
          type: boolean
    Task:
      type: object
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        description:
          type: string
        status:
          $ref: '#/components/schemas/Status'
        priority:
          $ref: '#/components/schemas/Priority'
        config:
          $ref: '#/components/schemas/Config'
        type:
          type: string
          const: task
        inlineStatus:
          type: string
          enum:
            - draft
            - published
        nullableDescription:
          type: string
          nullable: true
        nullableStatus:
          allOf:
            - $ref: '#/components/schemas/Status'
          nullable: true
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should correctly apply defaultNullable to primitive and $ref properties", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Primitive properties SHOULD have .nullable()
			expect(output).toMatch(/title:\s*z\.string\(\)\.nullable\(\)/);
			expect(output).toMatch(/description:\s*z\.string\(\)\.nullable\(\)/);

			// $ref properties SHOULD have .nullable() when defaultNullable: true
			expect(output).toMatch(/status:\s*statusSchema\.nullable\(\)/);
			expect(output).toMatch(/priority:\s*prioritySchema\.nullable\(\)/);
			expect(output).toMatch(/config:\s*configSchema\.nullable\(\)/);

			// const/literal should NOT have .nullable()
			expect(output).toMatch(/type:\s*z\.literal\("task"\)(?!\.nullable)/);

			// inline enum should NOT have .nullable()
			expect(output).toMatch(/inlineStatus:\s*z\.enum\(\["draft",\s*"published"\]\)(?!\.nullable)/);

			// Explicitly nullable properties SHOULD have .nullable()
			expect(output).toMatch(/nullableDescription:\s*z\.string\(\)\.nullable\(\)/);
			expect(output).toMatch(/nullableStatus:.*\.nullable\(\)/);
		});

		it("should not apply defaultNullable when set to false", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: false,
			});
			const output = generator.generateString();

			// Primitive properties without explicit nullable should NOT have .nullable()
			expect(output).toMatch(/title:\s*z\.string\(\)(?!\.nullable)/);
			// description appears twice, once as primitive (not nullable) and once as nullableDescription (nullable)
			expect(output).toMatch(/description:\s*z\.string\(\)\.optional\(\)(?!\.nullable)/);

			// $ref properties should NOT have .nullable() when defaultNullable: false
			expect(output).toMatch(/status:\s*statusSchema\.optional\(\)(?!\.nullable)/);
			expect(output).toMatch(/priority:\s*prioritySchema\.optional\(\)(?!\.nullable)/);
			expect(output).toMatch(/config:\s*configSchema\.optional\(\)(?!\.nullable)/);

			// const/literal should NOT have .nullable()
			expect(output).not.toContain('z.literal("task").nullable()');

			// inline enum should NOT have .nullable()
			expect(output).not.toMatch(/inlineStatus:\s*z\.enum\(\["draft",\s*"published"\]\)\.nullable\(\)/);

			// Only explicitly nullable properties SHOULD have .nullable()
			expect(output).toMatch(/nullableDescription:\s*z\.string\(\)\.nullable\(\)/);
			expect(output).toMatch(/nullableStatus:.*\.nullable\(\)/);
		});
	});
});
