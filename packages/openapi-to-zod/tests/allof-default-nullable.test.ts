import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

/**
 * Tests for allOf/oneOf/anyOf composition with defaultNullable: true
 *
 * Bug: When defaultNullable is true, schemas used as base in allOf compositions
 * were incorrectly getting .nullable() applied before .extend(), resulting in
 * invalid code like: baseSchema.nullable().extend({...})
 *
 * Additionally, the final composition result was getting .nullable() applied
 * even when the schema didn't have explicit nullable: true.
 *
 * Fix: Suppress defaultNullable when generating schemas for compositions.
 * - Nullable on the final result should only come from explicit nullable: true
 * - Base/ref schemas in extend chains should never have defaultNullable applied
 * - Properties INSIDE inline objects still respect defaultNullable
 */
describe("AllOf with defaultNullable: true", () => {
	const testDir = join(__dirname, "fixtures", "allof-default-nullable-test");

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Base schema in allOf should not have .nullable() before .extend()", () => {
		const specPath = join(testDir, "allof-extend-nullable.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: AllOf Default Nullable Test
  version: 1.0.0
paths: {}
components:
  schemas:
    DossierWithoutRelations:
      type: object
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
        externalKey:
          type: string
        dateStart:
          type: string
          format: date
        dateEnd:
          type: string
          format: date
    Pregnancy:
      type: object
      properties:
        id:
          type: string
          format: uuid
        dateOfBirthExpected:
          type: string
          format: date
    PregnancyDossier:
      allOf:
        - $ref: '#/components/schemas/DossierWithoutRelations'
        - type: object
          properties:
            pregnancy:
              $ref: '#/components/schemas/Pregnancy'
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should NOT have .nullable().extend() pattern when defaultNullable is true", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// This is the bug: baseSchema.nullable().extend() is invalid
			expect(output).not.toContain("dossierWithoutRelationsSchema.nullable().extend(");

			// The correct pattern should be: baseSchema.extend()
			expect(output).toContain("dossierWithoutRelationsSchema.extend(");
		});

		it("should NOT have .nullable() on the final allOf result when not explicitly nullable", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// The PregnancyDossier schema should NOT end with .nullable()
			// because it doesn't have explicit nullable: true
			expect(output).not.toMatch(/pregnancyDossierSchema\s*=\s*.*\.nullable\(\)\s*;/);
		});

		it("should have .nullable() on the final result ONLY if explicitly nullable", () => {
			const spec = `
openapi: 3.0.3
info:
  title: Nullable AllOf Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Base:
      type: object
      properties:
        id:
          type: string
    NullableExtended:
      nullable: true
      allOf:
        - $ref: '#/components/schemas/Base'
        - type: object
          properties:
            name:
              type: string
`;
			const nullableSpecPath = join(testDir, "nullable-allof.yaml");
			writeFileSync(nullableSpecPath, spec.trim());

			const generator = new OpenApiGenerator({
				input: nullableSpecPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Should NOT have .nullable().extend()
			expect(output).not.toContain(".nullable().extend(");

			// Should have .extend(...).nullable() at the end for NullableExtended
			expect(output).toMatch(/nullableExtendedSchema\s*=\s*baseSchema\.extend\(\{[\s\S]*?\}\)\.nullable\(\)/);
		});
	});

	describe("Multiple $ref schemas in allOf with defaultNullable: true", () => {
		const specPath = join(testDir, "multi-ref-allof.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Multi Ref AllOf Test
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
    Timestamped:
      type: object
      properties:
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    AuditInfo:
      type: object
      properties:
        createdBy:
          type: string
        updatedBy:
          type: string
    FullEntity:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - $ref: '#/components/schemas/Timestamped'
        - $ref: '#/components/schemas/AuditInfo'
        - type: object
          properties:
            name:
              type: string
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should not have any .nullable().extend() or .nullable().shape patterns", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Should NOT have .nullable().extend()
			expect(output).not.toContain(".nullable().extend(");

			// Should NOT have .nullable().shape
			expect(output).not.toContain(".nullable().shape");

			// Should have proper extend chain without nullable before extend
			expect(output).toContain("baseEntitySchema.extend(");
			expect(output).toContain(".extend(timestampedSchema.shape)");
			expect(output).toContain(".extend(auditInfoSchema.shape)");
		});
	});

	describe("Nested allOf with defaultNullable: true", () => {
		const specPath = join(testDir, "nested-allof.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Nested AllOf Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Base:
      type: object
      properties:
        id:
          type: string
    Extended:
      allOf:
        - $ref: '#/components/schemas/Base'
        - type: object
          properties:
            name:
              type: string
    FurtherExtended:
      allOf:
        - $ref: '#/components/schemas/Extended'
        - type: object
          properties:
            description:
              type: string
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should handle nested allOf without .nullable().extend()", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Should NOT have .nullable().extend()
			expect(output).not.toContain(".nullable().extend(");

			// Extended should reference Base without nullable before extend
			expect(output).toContain("baseSchema.extend(");

			// FurtherExtended should reference Extended without nullable before extend
			expect(output).toContain("extendedSchema.extend(");
		});
	});

	describe("Properties within allOf should still respect defaultNullable", () => {
		const specPath = join(testDir, "props-nullable.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Props Nullable Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Base:
      type: object
      properties:
        id:
          type: string
    Extended:
      allOf:
        - $ref: '#/components/schemas/Base'
        - type: object
          properties:
            name:
              type: string
            email:
              type: string
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should have .nullable() on primitive properties within the allOf inline object", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Properties inside the inline object should have .nullable()
			expect(output).toMatch(/name:\s*z\.string\(\)\.nullable\(\)/);
			expect(output).toMatch(/email:\s*z\.string\(\)\.nullable\(\)/);

			// But the base schema reference should NOT have .nullable() before .extend()
			expect(output).not.toContain("baseSchema.nullable().extend(");
		});
	});

	describe("Single-item allOf with defaultNullable: true", () => {
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

		it("should NOT apply defaultNullable to single-item allOf (schema definition)", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Alias without explicit nullable should NOT get .nullable()
			// because it's a schema definition, not a property reference
			expect(output).toMatch(/aliasSchema\s*=\s*originalSchema\s*;/);

			// NullableAlias with explicit nullable: true SHOULD have .nullable()
			expect(output).toMatch(/nullableAliasSchema\s*=\s*originalSchema\.nullable\(\)/);
		});
	});

	describe("Real-world scenario: Dossier pattern", () => {
		const specPath = join(testDir, "dossier-pattern.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Dossier Pattern Test
  version: 1.0.0
paths: {}
components:
  schemas:
    DossierWithoutRelations:
      type: object
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
          enum:
            - illness
            - pregnancy
        externalKey:
          type: string
        dateReported:
          type: string
          format: date
        dateStart:
          type: string
          format: date
        dateEnd:
          type: string
          format: date
        dateCreated:
          type: string
        dateUpdated:
          type: string
    Pregnancy:
      type: object
      properties:
        id:
          type: string
          format: uuid
        externalKey:
          type: string
        dateOfBirthExpected:
          type: string
          format: date
        dateOfActualBirth:
          type: string
          format: date
    PregnancyDossier:
      allOf:
        - $ref: '#/components/schemas/DossierWithoutRelations'
        - type: object
          properties:
            pregnancy:
              $ref: '#/components/schemas/Pregnancy'
    EmploymentWithoutRelations:
      type: object
      properties:
        id:
          type: string
          format: uuid
        externalKey:
          type: string
        employmentNumber:
          type: integer
    DossierWithEmployment:
      allOf:
        - $ref: '#/components/schemas/DossierWithoutRelations'
        - type: object
          properties:
            employment:
              $ref: '#/components/schemas/EmploymentWithoutRelations'
    IllnessDossier:
      allOf:
        - $ref: '#/components/schemas/DossierWithEmployment'
        - type: object
          properties:
            diagnosis:
              type: string
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should generate valid code without .nullable().extend() pattern", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Should NOT have .nullable().extend()
			expect(output).not.toContain(".nullable().extend(");

			// Should have correct extend patterns
			expect(output).toContain("dossierWithoutRelationsSchema.extend(");

			// PregnancyDossier should extend DossierWithoutRelations
			expect(output).toMatch(/pregnancyDossierSchema\s*=\s*dossierWithoutRelationsSchema\.extend\(/);

			// DossierWithEmployment should extend DossierWithoutRelations
			expect(output).toMatch(/dossierWithEmploymentSchema\s*=\s*dossierWithoutRelationsSchema\.extend\(/);

			// IllnessDossier should extend DossierWithEmployment
			expect(output).toMatch(/illnessDossierSchema\s*=\s*dossierWithEmploymentSchema\.extend\(/);
		});

		it("should have .nullable() on property references within the inline objects", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// The pregnancy property inside PregnancyDossier's inline object should have .nullable()
			// because it's a $ref at property level with defaultNullable: true
			expect(output).toMatch(/pregnancy:\s*pregnancySchema\.nullable\(\)/);

			// Similarly for employment in DossierWithEmployment
			expect(output).toMatch(/employment:\s*employmentWithoutRelationsSchema\.nullable\(\)/);
		});
	});
});

describe("OneOf/AnyOf with defaultNullable: true", () => {
	const testDir = join(__dirname, "fixtures", "union-default-nullable-test");

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("oneOf should not have .nullable() on result from defaultNullable", () => {
		const specPath = join(testDir, "oneof-nullable.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: OneOf Default Nullable Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Cat:
      type: object
      properties:
        meow:
          type: string
    Dog:
      type: object
      properties:
        bark:
          type: string
    Pet:
      oneOf:
        - $ref: '#/components/schemas/Cat'
        - $ref: '#/components/schemas/Dog'
    NullablePet:
      nullable: true
      oneOf:
        - $ref: '#/components/schemas/Cat'
        - $ref: '#/components/schemas/Dog'
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should NOT have .nullable() on oneOf result without explicit nullable", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Pet (non-nullable oneOf) should NOT end with .nullable()
			expect(output).toMatch(/petSchema\s*=\s*z\.union\(\[catSchema,\s*dogSchema\]\)\s*;/);

			// NullablePet (explicit nullable: true) SHOULD have .nullable()
			expect(output).toMatch(/nullablePetSchema\s*=\s*z\.union\(\[catSchema,\s*dogSchema\]\)\.nullable\(\)/);
		});

		it("should NOT have .nullable() on individual union variants", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Should NOT have catSchema.nullable() or dogSchema.nullable() inside the union
			expect(output).not.toContain("catSchema.nullable()");
			expect(output).not.toContain("dogSchema.nullable()");
		});
	});

	describe("anyOf should not have .nullable() on result from defaultNullable", () => {
		const specPath = join(testDir, "anyof-nullable.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: AnyOf Default Nullable Test
  version: 1.0.0
paths: {}
components:
  schemas:
    StringValue:
      type: object
      properties:
        stringVal:
          type: string
    NumberValue:
      type: object
      properties:
        numberVal:
          type: number
    MixedValue:
      anyOf:
        - $ref: '#/components/schemas/StringValue'
        - $ref: '#/components/schemas/NumberValue'
    NullableMixedValue:
      nullable: true
      anyOf:
        - $ref: '#/components/schemas/StringValue'
        - $ref: '#/components/schemas/NumberValue'
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should NOT have .nullable() on anyOf result without explicit nullable", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// MixedValue (non-nullable anyOf) should NOT end with .nullable()
			expect(output).toMatch(/mixedValueSchema\s*=\s*z\.union\(\[stringValueSchema,\s*numberValueSchema\]\)\s*;/);

			// NullableMixedValue (explicit nullable: true) SHOULD have .nullable()
			expect(output).toMatch(
				/nullableMixedValueSchema\s*=\s*z\.union\(\[stringValueSchema,\s*numberValueSchema\]\)\.nullable\(\)/
			);
		});
	});

	describe("discriminatedUnion should not have .nullable() from defaultNullable", () => {
		const specPath = join(testDir, "discriminated-nullable.yaml");

		beforeAll(() => {
			const spec = `
openapi: 3.0.3
info:
  title: Discriminated Union Default Nullable Test
  version: 1.0.0
paths: {}
components:
  schemas:
    Cat:
      type: object
      required:
        - petType
      properties:
        petType:
          type: string
          enum:
            - cat
        meow:
          type: string
    Dog:
      type: object
      required:
        - petType
      properties:
        petType:
          type: string
          enum:
            - dog
        bark:
          type: string
    Pet:
      oneOf:
        - $ref: '#/components/schemas/Cat'
        - $ref: '#/components/schemas/Dog'
      discriminator:
        propertyName: petType
`;
			writeFileSync(specPath, spec.trim());
		});

		it("should NOT have .nullable() on discriminatedUnion result without explicit nullable", () => {
			const generator = new OpenApiGenerator({
				input: specPath,
				outputTypes: "output.ts",
				defaultNullable: true,
			});
			const output = generator.generateString();

			// Pet should use discriminatedUnion without .nullable()
			expect(output).toMatch(/petSchema\s*=\s*z\.discriminatedUnion\("petType",\s*\[catSchema,\s*dogSchema\]\)\s*;/);
		});
	});
});
