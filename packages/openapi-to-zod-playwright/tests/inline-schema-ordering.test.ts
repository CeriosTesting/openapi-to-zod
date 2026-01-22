import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Inline Schema Type Ordering", () => {
	describe("schema and type should be together", () => {
		it("should place type immediately after its schema (not grouped at end)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-response-schemas-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			// Find the inline response schemas section
			const inlineSectionMatch = schemasOutput.match(/\/\/ Inline Response Schemas[\s\S]*$/);
			expect(inlineSectionMatch).toBeTruthy();
			if (!inlineSectionMatch) {
				throw new Error("Inline Response Schemas section not found");
			}

			const inlineSection = inlineSectionMatch[0];

			// Should NOT have all types grouped together at the end with a separate header
			expect(inlineSection).not.toContain("// Inline Response Types");

			// Each schema export should be immediately followed by its type export
			// Pattern: export const xxxSchema = ...; followed by export type Xxx = z.infer<...>
			const schemaTypePattern = /export const (\w+)Schema = [^;]+;\s*export type (\w+) = z\.infer<typeof \1Schema>;/g;
			const matches = [...inlineSection.matchAll(schemaTypePattern)];

			// Should have at least one schema/type pair
			expect(matches.length).toBeGreaterThan(0);
		});

		it("should match component schema generation pattern with blank lines between pairs", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-response-schemas-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			// Find the inline response schemas section
			const inlineSectionMatch = schemasOutput.match(/\/\/ Inline Response Schemas[\s\S]*$/);
			expect(inlineSectionMatch).toBeTruthy();
			if (!inlineSectionMatch) {
				throw new Error("Inline Response Schemas section not found");
			}

			const inlineSection = inlineSectionMatch[0];

			// Count schemas and types
			const schemaCount = (inlineSection.match(/export const \w+Schema/g) || []).length;
			const typeCount = (inlineSection.match(/export type \w+ = z\.infer/g) || []).length;

			// Should have equal number of schemas and types
			expect(schemaCount).toBe(typeCount);

			// If there are multiple schemas, there should be blank line separations between pairs
			if (schemaCount > 1) {
				// Pattern: type export followed by blank line, then next schema export
				const pairSeparationPattern = /export type \w+ = z\.infer<[^>]+>;\n\nexport const/g;
				const separationMatches = [...inlineSection.matchAll(pairSeparationPattern)];
				expect(separationMatches.length).toBe(schemaCount - 1);
			}
		});

		it("should not have separate types section header", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-response-schemas-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			// Should NOT have a separate "Inline Response Types" section
			expect(schemasOutput).not.toContain("// Inline Response Types");
		});
	});

	describe("ordering with multiple inline schemas", () => {
		it("should sort schemas alphabetically", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-response-schemas-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			// Find the inline response schemas section
			const inlineSectionStart = schemasOutput.indexOf("// Inline Response Schemas");
			expect(inlineSectionStart).toBeGreaterThan(-1);

			const inlineSection = schemasOutput.slice(inlineSectionStart);

			// Find all inline response schema names in order
			const schemaMatches = inlineSection.match(/export const (\w+ResponseSchema)/g) || [];
			const schemaNames = schemaMatches.map(m => m.replace("export const ", ""));

			// Should be sorted alphabetically
			const sortedNames = [...schemaNames].sort();
			expect(schemaNames).toEqual(sortedNames);
		});

		it("should maintain schema-type pairs even with many schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-response-schemas-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			const inlineSectionMatch = schemasOutput.match(/\/\/ Inline Response Schemas[\s\S]*$/);
			expect(inlineSectionMatch).toBeTruthy();
			if (!inlineSectionMatch) {
				throw new Error("Inline Response Schemas section not found");
			}

			const inlineSection = inlineSectionMatch[0];

			// Count schemas and types
			const schemaCount = (inlineSection.match(/export const \w+Schema/g) || []).length;
			const typeCount = (inlineSection.match(/export type \w+ = z\.infer/g) || []).length;

			// Should have equal number of schemas and types
			expect(schemaCount).toBe(typeCount);
			expect(schemaCount).toBeGreaterThan(0);

			// Each schema should have its type immediately after (before the next schema)
			// Use regex to find schema-type pairs
			const schemaTypePattern = /export const (\w+Schema) = [^;]+;\s*export type \w+ = z\.infer<typeof \1>;/gs;
			const matches = [...inlineSection.matchAll(schemaTypePattern)];
			expect(matches.length).toBe(schemaCount);
		});
	});

	describe("with prefix and suffix options", () => {
		it("should maintain schema-type pairing with prefix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-response-schemas-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				prefix: "api",
			});

			const schemasOutput = generator.generateSchemasString();

			// Schema names should have prefix
			expect(schemasOutput).toMatch(/export const api\w+ResponseSchema/);

			// Type should immediately follow schema and reference it
			const schemaTypePattern =
				/export const (api\w+ResponseSchema) = [^;]+;\s*export type (\w+Response) = z\.infer<typeof \1>;/;
			expect(schemasOutput).toMatch(schemaTypePattern);
		});

		it("should maintain schema-type pairing with suffix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-response-schemas-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				suffix: "Dto",
			});

			const schemasOutput = generator.generateSchemasString();

			// Schema names should have suffix
			expect(schemasOutput).toMatch(/export const \w+ResponseDtoSchema/);

			// Type should immediately follow schema
			const schemaTypePattern =
				/export const (\w+ResponseDtoSchema) = [^;]+;\s*export type (\w+Response) = z\.infer<typeof \1>;/;
			expect(schemasOutput).toMatch(schemaTypePattern);
		});
	});
});
