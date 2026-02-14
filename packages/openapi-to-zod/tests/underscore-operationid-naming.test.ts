import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";

describe("Underscore OperationId Schema Naming", () => {
	const fixtureInput = resolve(__dirname, "fixtures/underscore-operationids.yaml");

	describe("Query Parameter Schema Naming", () => {
		it("should generate consistent query parameter schema names for underscore operationIds", () => {
			const options: OpenApiGeneratorOptions = {
				input: fixtureInput,
				outputTypes: "output.ts",
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			const output = generator.generateString();

			// Get_Profit_Users operationId should become getProfitUsersQueryParamsSchema
			expect(output).toContain("export const getProfitUsersQueryParamsSchema");
			expect(output).toContain(
				"export type GetProfitUsersQueryParams = z.infer<typeof getProfitUsersQueryParamsSchema>"
			);

			// get_Profit_Address operationId should become getProfitAddressQueryParamsSchema
			expect(output).toContain("export const getProfitAddressQueryParamsSchema");
			expect(output).toContain(
				"export type GetProfitAddressQueryParams = z.infer<typeof getProfitAddressQueryParamsSchema>"
			);

			// Get_API_V1_Data_List operationId should become getAPIV1DataListQueryParamsSchema
			// Note: All-uppercase segments like "API" and "V1" preserve their casing
			expect(output).toContain("export const getAPIV1DataListQueryParamsSchema");
			expect(output).toContain(
				"export type GetAPIV1DataListQueryParams = z.infer<typeof getAPIV1DataListQueryParamsSchema>"
			);
		});

		it("should NOT have underscores in exported query parameter schema names", () => {
			const options: OpenApiGeneratorOptions = {
				input: fixtureInput,
				outputTypes: "output.ts",
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			const output = generator.generateString();

			// Schema declarations should not contain underscores
			expect(output).not.toMatch(/export const .*_.*QueryParamsSchema/);

			// Type infer references should not have mismatch
			// This regex checks for z.infer referencing a name with underscores
			expect(output).not.toMatch(/z\.infer<typeof \w*_\w*QueryParamsSchema>/);
		});

		it("should ensure schema declaration matches type inference reference", () => {
			const options: OpenApiGeneratorOptions = {
				input: fixtureInput,
				outputTypes: "output.ts",
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			const output = generator.generateString();

			// Extract all QueryParamsSchema declarations and verify matching infer references
			const schemaDeclarations = output.match(/export const (\w+QueryParamsSchema)/g) || [];
			const schemaNames = schemaDeclarations.map(d => d.replace("export const ", ""));

			for (const schemaName of schemaNames) {
				// Each declared schema should have a matching z.infer reference
				expect(output).toContain(`z.infer<typeof ${schemaName}>`);
			}
		});
	});

	describe("Header Parameter Schema Naming", () => {
		it("should generate consistent header parameter schema names for underscore operationIds", () => {
			const options: OpenApiGeneratorOptions = {
				input: fixtureInput,
				outputTypes: "output.ts",
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			const output = generator.generateString();

			// Create_Order_History_Entry operationId should become createOrderHistoryEntryHeaderParamsSchema
			expect(output).toContain("export const createOrderHistoryEntryHeaderParamsSchema");
			expect(output).toContain(
				"export type CreateOrderHistoryEntryHeaderParams = z.infer<typeof createOrderHistoryEntryHeaderParamsSchema>"
			);

			// Update_Mixed_Params_Resource operationId should become updateMixedParamsResourceHeaderParamsSchema
			expect(output).toContain("export const updateMixedParamsResourceHeaderParamsSchema");
			expect(output).toContain(
				"export type UpdateMixedParamsResourceHeaderParams = z.infer<typeof updateMixedParamsResourceHeaderParamsSchema>"
			);
		});

		it("should NOT have underscores in exported header parameter schema names", () => {
			const options: OpenApiGeneratorOptions = {
				input: fixtureInput,
				outputTypes: "output.ts",
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			const output = generator.generateString();

			// Schema declarations should not contain underscores
			expect(output).not.toMatch(/export const .*_.*HeaderParamsSchema/);

			// Type infer references should not have mismatch
			expect(output).not.toMatch(/z\.infer<typeof \w*_\w*HeaderParamsSchema>/);
		});

		it("should ensure header schema declaration matches type inference reference", () => {
			const options: OpenApiGeneratorOptions = {
				input: fixtureInput,
				outputTypes: "output.ts",
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			const output = generator.generateString();

			// Extract all HeaderParamsSchema declarations and verify matching infer references
			const schemaDeclarations = output.match(/export const (\w+HeaderParamsSchema)/g) || [];
			const schemaNames = schemaDeclarations.map(d => d.replace("export const ", ""));

			for (const schemaName of schemaNames) {
				// Each declared schema should have a matching z.infer reference
				expect(output).toContain(`z.infer<typeof ${schemaName}>`);
			}
		});
	});

	describe("Mixed Parameters with Underscore OperationIds", () => {
		it("should handle operations with both query and header params correctly", () => {
			const options: OpenApiGeneratorOptions = {
				input: fixtureInput,
				outputTypes: "output.ts",
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			const output = generator.generateString();

			// Update_Mixed_Params_Resource should have both query and header params
			expect(output).toContain("export const updateMixedParamsResourceQueryParamsSchema");
			expect(output).toContain("export const updateMixedParamsResourceHeaderParamsSchema");

			// Both should have matching type exports
			expect(output).toContain(
				"export type UpdateMixedParamsResourceQueryParams = z.infer<typeof updateMixedParamsResourceQueryParamsSchema>"
			);
			expect(output).toContain(
				"export type UpdateMixedParamsResourceHeaderParams = z.infer<typeof updateMixedParamsResourceHeaderParamsSchema>"
			);
		});
	});

	describe("Response and Request Schema Naming", () => {
		it("should generate consistent response schema names for underscore operationIds", () => {
			const options: OpenApiGeneratorOptions = {
				input: fixtureInput,
				outputTypes: "output.ts",
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			const output = generator.generateString();

			// Inline response schemas should not have underscores
			// Note: The exact naming depends on if there are multiple status codes
			// but the schema names should still be consistent
			expect(output).not.toMatch(/export const .*_.*ResponseSchema/);
		});
	});

	describe("TypeScript Compilation Validity", () => {
		it("should generate code where all type references resolve", () => {
			const options: OpenApiGeneratorOptions = {
				input: fixtureInput,
				outputTypes: "output.ts",
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			const output = generator.generateString();

			// Find all z.infer<typeof X> references
			const inferMatches = output.match(/z\.infer<typeof (\w+)>/g) || [];
			const referencedSchemas = inferMatches
				.map(match => {
					const schemaName = match.match(/typeof (\w+)/)?.[1];
					return schemaName;
				})
				.filter(Boolean) as string[];

			// Each referenced schema should be declared
			for (const schemaName of referencedSchemas) {
				expect(output).toContain(`export const ${schemaName}`);
			}
		});
	});
});
