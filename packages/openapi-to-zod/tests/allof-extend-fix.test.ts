import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

/**
 * Tests for allOf composition edge cases, specifically around:
 * 1. .extend() usage with nullable allOf compositions (fixing .nullable().shape bug)
 * 2. Inline objects should pass shape directly to .extend(), not use .shape
 * 3. .nullable() should be applied after all .extend() calls
 *
 * Bug fixed: Previously, inline objects in allOf with nullable: true would generate:
 *   baseSchema.extend(z.object({...}).nullable().shape)
 * This is invalid because ZodNullable doesn't have a .shape property.
 *
 * Fix: For inline objects, we now generate the shape directly:
 *   baseSchema.extend({ prop: z.string() })
 * And apply .nullable() at the end if needed:
 *   baseSchema.extend({ prop: z.string() }).nullable()
 */
describe("AllOf Extend Fix", () => {
	const testDir = join(__dirname, "fixtures", "allof-extend-test");

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Nullable allOf should apply .nullable() after .extend()", () => {
		const specPath = join(testDir, "nullable-allof.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Nullable AllOf Test
  version: 1.0.0
paths: {}
components:
  schemas:
    BaseEntity:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
    ExtendedEntity:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          properties:
            extra:
              type: string
    NullableInlineExtension:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          nullable: true
          properties:
            extra:
              type: string
    TopLevelNullableAllOf:
      nullable: true
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          properties:
            extra:
              type: string
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should NOT have .nullable().shape pattern (which is invalid)", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// This pattern is INVALID - .nullable() doesn't have .shape
			expect(output).not.toContain(".nullable().shape");
		});

		it("should use inline shape directly for inline objects, not z.object().shape", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// For inline objects in allOf, should use .extend({ prop: ... })
			// NOT .extend(z.object({...}).shape)
			expect(output).toMatch(/\.extend\(\{\s*\n?\s*extra:/);
		});

		it("should place .nullable() after .extend() for nullable allOf", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// topLevelNullableAllOfSchema should have .nullable() at the end
			expect(output).toMatch(
				/topLevelNullableAllOfSchema\s*=\s*baseEntitySchema\.extend\(\{[\s\S]*?\}\)\.nullable\(\)/
			);
		});

		it("should NOT add .nullable() for non-nullable allOf", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// ExtendedEntity should NOT have .nullable()
			const extendedEntityMatch = output.match(/export const extendedEntitySchema\s*=\s*[^;]+;/);
			expect(extendedEntityMatch).toBeTruthy();
			expect(extendedEntityMatch?.[0]).not.toContain(".nullable()");
		});
	});

	describe("allOf with only $ref schemas (no inline objects)", () => {
		const specPath = join(testDir, "ref-only-allof.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Ref Only AllOf Test
  version: 1.0.0
paths: {}
components:
  schemas:
    BaseA:
      type: object
      properties:
        a:
          type: string
    BaseB:
      type: object
      properties:
        b:
          type: string
    Combined:
      allOf:
        - $ref: '#/components/schemas/BaseA'
        - $ref: '#/components/schemas/BaseB'
    CombinedNullable:
      nullable: true
      allOf:
        - $ref: '#/components/schemas/BaseA'
        - $ref: '#/components/schemas/BaseB'
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should use .extend(schema.shape) for ref-only allOf", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// Should use .extend(otherSchema.shape) pattern for $ref schemas
			expect(output).toMatch(/baseASchema\.extend\(baseBSchema\.shape\)/);
		});

		it("should apply .nullable() after the extend chain", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// CombinedNullable should have .nullable() at the end
			expect(output).toMatch(/combinedNullableSchema\s*=\s*baseASchema\.extend\(baseBSchema\.shape\)\.nullable\(\)/);
		});
	});

	describe("Single-item allOf simplification", () => {
		const specPath = join(testDir, "single-allof.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Single AllOf Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Original:
      type: object
      properties:
        name:
          type: string
    Alias:
      allOf:
        - $ref: '#/components/schemas/Original'
    NullableAlias:
      nullable: true
      allOf:
        - $ref: '#/components/schemas/Original'
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should simplify single-item allOf to direct reference", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// Alias should just reference originalSchema (no .extend() needed)
			expect(output).toMatch(/aliasSchema\s*=\s*originalSchema;/);
		});

		it("should handle nullable single-item allOf correctly", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// NullableAlias should be originalSchema.nullable()
			expect(output).toMatch(/nullableAliasSchema\s*=\s*originalSchema\.nullable\(\)/);
		});
	});

	describe("allOf with mixed refs and inline objects", () => {
		const specPath = join(testDir, "mixed-allof.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Mixed AllOf Test
  version: 1.0.0
paths: {}
components:
  schemas:
    BaseEntity:
      type: object
      properties:
        id:
          type: string
    Timestamped:
      type: object
      properties:
        createdAt:
          type: string
          format: date-time
    User:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - $ref: '#/components/schemas/Timestamped'
        - type: object
          properties:
            username:
              type: string
          required:
            - username
    NullableUser:
      nullable: true
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - $ref: '#/components/schemas/Timestamped'
        - type: object
          properties:
            username:
              type: string
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should chain multiple .extend() calls correctly", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// Should have pattern like:
			// baseEntitySchema.extend(timestampedSchema.shape).extend({ username: ... })
			expect(output).toMatch(/baseEntitySchema\.extend\(timestampedSchema\.shape\)\.extend\(\{/);
		});

		it("should place .nullable() after all .extend() calls", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// NullableUser should have .nullable() at the very end
			expect(output).toMatch(/nullableUserSchema[\s\S]*?\.extend\(\{[\s\S]*?\}\)\.nullable\(\)/);
		});

		it("should NOT have invalid .nullable().shape pattern", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			expect(output).not.toContain(".nullable().shape");
		});
	});

	describe("Complex nested allOf (response envelope pattern)", () => {
		const specPath = join(testDir, "complex-allof.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Complex AllOf Test
  version: 1.0.0
paths: {}
components:
  schemas:
    ResponseEnvelope:
      type: object
      properties:
        message:
          type: string
        status:
          type: integer
        traceId:
          type: string
          format: uuid
    DataWrapper:
      allOf:
        - $ref: '#/components/schemas/ResponseEnvelope'
        - type: object
          nullable: true
          properties:
            data:
              type: object
              properties:
                id:
                  type: string
                name:
                  type: string
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should handle nullable inline object with nested properties", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// Should NOT have .nullable().shape
			expect(output).not.toContain(".nullable().shape");

			// The data property should be properly nested
			expect(output).toContain("data:");
		});
	});

	describe("Empty inline object in allOf", () => {
		const specPath = join(testDir, "empty-inline-allof.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Empty Inline AllOf Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Base:
      type: object
      properties:
        id:
          type: string
    ExtendedWithEmpty:
      allOf:
        - $ref: '#/components/schemas/Base'
        - type: object
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should handle empty inline object in allOf", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
			});
			const output = generator.generateString();

			// Should generate valid code - either extend with empty or just reference
			expect(output).not.toContain(".nullable().shape");

			// Should contain the extended schema
			expect(output).toContain("extendedWithEmptySchema");
		});
	});

	describe("allOf composition should produce valid runtime schemas", () => {
		const specPath = join(testDir, "runtime-allof.yaml");
		const outputPath = join(testDir, "runtime-allof-output.ts");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Runtime AllOf Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Base:
      type: object
      properties:
        id:
          type: string
      required:
        - id
    Extended:
      allOf:
        - $ref: '#/components/schemas/Base'
        - type: object
          properties:
            name:
              type: string
          required:
            - name
    NullableExtended:
      nullable: true
      allOf:
        - $ref: '#/components/schemas/Base'
        - type: object
          properties:
            name:
              type: string
          required:
            - name
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should generate schemas that parse valid data correctly", async () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: outputPath,
				showStats: false,
			});

			generator.generate();

			const { baseSchema, extendedSchema, nullableExtendedSchema } = await import(outputPath);

			// Base schema should work
			expect(() => baseSchema.parse({ id: "123" })).not.toThrow();
			expect(() => baseSchema.parse({})).toThrow();

			// Extended schema should require both fields
			expect(() => extendedSchema.parse({ id: "123", name: "test" })).not.toThrow();
			expect(() => extendedSchema.parse({ id: "123" })).toThrow();
			expect(() => extendedSchema.parse({ name: "test" })).toThrow();

			// Nullable extended should accept null
			expect(() => nullableExtendedSchema.parse(null)).not.toThrow();
			expect(() => nullableExtendedSchema.parse({ id: "123", name: "test" })).not.toThrow();
		});
	});
});
