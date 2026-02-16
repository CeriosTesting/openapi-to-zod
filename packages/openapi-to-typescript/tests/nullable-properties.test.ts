import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { TypeScriptGenerator } from "../src/typescript-generator";

describe("Nullable Type Handling", () => {
	const fixturePath = resolve(__dirname, "fixtures/nullable-properties.yaml");

	describe("OpenAPI 3.0 nullable: true", () => {
		it("should generate | null for required nullable string properties", () => {
			const generator = new TypeScriptGenerator({
				input: fixturePath,
				outputTypes: "types.ts",
			});
			const output = generator.generateString();

			// email is required AND nullable, should be: email: string | null (no ?)
			expect(output).toMatch(/email:\s*string\s*\|\s*null/);
		});

		it("should generate | null for optional nullable properties", () => {
			const generator = new TypeScriptGenerator({
				input: fixturePath,
				outputTypes: "types.ts",
			});
			const output = generator.generateString();

			// phone is optional AND nullable, should be: phone?: string | null
			expect(output).toMatch(/phone\?:\s*string\s*\|\s*null/);
			// middleName is optional AND nullable too
			expect(output).toMatch(/middleName\?:\s*string\s*\|\s*null/);
		});

		it("should NOT add | null for non-nullable properties", () => {
			const generator = new TypeScriptGenerator({
				input: fixturePath,
				outputTypes: "types.ts",
			});
			const output = generator.generateString();

			// id is required and NOT nullable, should be: id: string (no | null)
			expect(output).toMatch(/id:\s*string(?!\s*\|\s*null)/);
			// name is required and NOT nullable
			expect(output).toMatch(/name:\s*string(?!\s*\|\s*null)/);
		});

		it("should generate | null for nullable $ref properties", () => {
			const generator = new TypeScriptGenerator({
				input: fixturePath,
				outputTypes: "types.ts",
			});
			const output = generator.generateString();

			// address has $ref and nullable: true, should be: address?: Address | null
			expect(output).toMatch(/address\?:\s*Address\s*\|\s*null/);
		});

		it("should generate | null for nullable string type alias", () => {
			const generator = new TypeScriptGenerator({
				input: fixturePath,
				outputTypes: "types.ts",
			});
			const output = generator.generateString();

			// NullableString is type: string with nullable: true
			expect(output).toMatch(/export type NullableString\s*=\s*string\s*\|\s*null/);
		});

		it("should generate | null for nullable array type", () => {
			const generator = new TypeScriptGenerator({
				input: fixturePath,
				outputTypes: "types.ts",
			});
			const output = generator.generateString();

			// NullableArray is type: array with nullable: true
			expect(output).toMatch(/export type NullableArray\s*=\s*string\[\]\s*\|\s*null/);
		});

		it("should generate | null for nullable enum type", () => {
			const generator = new TypeScriptGenerator({
				input: fixturePath,
				outputTypes: "types.ts",
			});
			const output = generator.generateString();

			// NullableEnum is enum with nullable: true
			expect(output).toMatch(/export type NullableEnum\s*=\s*.*\|\s*null/);
			// Should include the enum values
			expect(output).toMatch(/"active"/);
			expect(output).toMatch(/"inactive"/);
			expect(output).toMatch(/"pending"/);
		});

		it("should generate | null for properties inside inline array items", () => {
			const generator = new TypeScriptGenerator({
				input: fixturePath,
				outputTypes: "types.ts",
			});
			const output = generator.generateString();

			// UsersResponse.rows is an array with inline object items
			// EmailForDigitalDocuments inside the inline object has nullable: true
			// This was the original bug - inline properties weren't getting | null
			expect(output).toMatch(/EmailForDigitalDocuments\?:\s*string\s*\|\s*null/);
		});
	});

	describe("Consistency with Zod schemas", () => {
		it("should generate types compatible with Zod .nullable() schemas", () => {
			const generator = new TypeScriptGenerator({
				input: fixturePath,
				outputTypes: "types.ts",
			});
			const output = generator.generateString();

			// When Zod generates z.string().nullable(), it infers to string | null
			// Our TypeScript types must match this for type compatibility
			// This test ensures nullable properties in inline schemas get | null

			// Check that inline object properties have | null
			expect(output).toContain("| null");

			// The inline array items should have nullable properties with | null
			expect(output).toMatch(/EmailForDigitalDocuments\?:\s*string\s*\|\s*null/);
		});
	});
});
