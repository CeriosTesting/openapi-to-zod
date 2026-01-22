import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

describe("Inline Response Schemas", () => {
	const fixturesDir = resolve(__dirname, "fixtures");
	const inlineSchemaApiPath = resolve(fixturesDir, "inline-response-schemas-api.yaml");

	describe("generateSchemasString", () => {
		it("should generate inline response schemas with proper naming", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: inlineSchemaApiPath,
				output: "test-output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const schemasString = generator.generateSchemasString();

			// Should contain the inline response schemas section header
			expect(schemasString).toContain("// Inline Response Schemas");

			// Should generate GetUsersResponse schema
			expect(schemasString).toContain("export const getUsersResponseSchema =");
			expect(schemasString).toContain("export type GetUsersResponse =");

			// Should generate CreateUserResponse schema
			expect(schemasString).toContain("export const createUserResponseSchema =");
			expect(schemasString).toContain("export type CreateUserResponse =");

			// Should generate GetUserByIdResponse schema (only single success response per endpoint)
			expect(schemasString).toContain("export const getUserByIdResponseSchema =");
			expect(schemasString).toContain("export type GetUserByIdResponse =");

			// Should generate GetProducts and GetHealth response schemas
			expect(schemasString).toContain("export const getProductsResponseSchema =");
			expect(schemasString).toContain("export type GetProductsResponse =");
			expect(schemasString).toContain("export const getHealthResponseSchema =");
			expect(schemasString).toContain("export type GetHealthResponse =");
		});

		it("should apply prefix and suffix to schema variable names only", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: inlineSchemaApiPath,
				output: "test-output.ts",
				outputClient: "client.ts",
				useOperationId: true,
				prefix: "Api",
				suffix: "Dto",
			});

			const schemasString = generator.generateSchemasString();

			// Schema variables should have prefix and suffix
			expect(schemasString).toContain("export const apiGetUsersResponseDtoSchema =");
			// Type names should NOT have prefix/suffix
			expect(schemasString).toContain("export type GetUsersResponse =");
			// The type should reference the prefixed/suffixed schema
			expect(schemasString).toContain("z.infer<typeof apiGetUsersResponseDtoSchema>");
		});

		it("should generate valid Zod schemas for inline responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: inlineSchemaApiPath,
				output: "test-output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const schemasString = generator.generateSchemasString();

			// GetUsers should be an array schema
			expect(schemasString).toMatch(/getUsersResponseSchema\s*=\s*z\.array\(/);

			// Schema should include constraints
			expect(schemasString).toContain(".min(1)"); // minLength: 1 on name
			expect(schemasString).toContain(".max(100)"); // maxLength: 100 on name
			expect(schemasString).toContain(".email()"); // format: email

			// GetHealthResponse should have enum constraint
			expect(schemasString).toContain('z.enum(["healthy", "unhealthy"])');
		});
	});

	describe("generateServiceString", () => {
		it("should use named inline schemas for response validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: inlineSchemaApiPath,
				output: "test-output.ts",
				outputService: "test-service.ts",
				outputClient: "test-client.ts",
				useOperationId: true,
			});

			const serviceString = generator.generateServiceString();

			// Should NOT contain "inline schema type not yet supported"
			expect(serviceString).not.toContain("inline schema type not yet supported");
			expect(serviceString).not.toContain("Parse and validate response body (inline schema)");

			// Should use named inline schemas for validation
			expect(serviceString).toContain("getUsersResponseSchema.parseAsync");
			expect(serviceString).toContain("createUserResponseSchema.parseAsync");
			expect(serviceString).toContain("getProductsResponseSchema.parseAsync");
			expect(serviceString).toContain("getHealthResponseSchema.parseAsync");
			expect(serviceString).toContain("getUserByIdResponseSchema.parseAsync");
		});

		it("should return proper types for inline response schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: inlineSchemaApiPath,
				output: "test-output.ts",
				outputService: "test-service.ts",
				outputClient: "test-client.ts",
				useOperationId: true,
			});

			const serviceString = generator.generateServiceString();

			// Should return typed promises
			expect(serviceString).toContain("Promise<GetUsersResponse>");
			expect(serviceString).toContain("Promise<CreateUserResponse>");
			expect(serviceString).toContain("Promise<GetProductsResponse>");
			expect(serviceString).toContain("Promise<GetHealthResponse>");
			expect(serviceString).toContain("Promise<GetUserByIdResponse>");
		});
	});

	describe("edge cases", () => {
		it("should handle specs without inline schemas", () => {
			const simpleApiPath = resolve(fixturesDir, "simple-api.yaml");
			const generator = new OpenApiPlaywrightGenerator({
				input: simpleApiPath,
				output: "test-output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const schemasString = generator.generateSchemasString();

			// Should not crash
			expect(schemasString).toBeDefined();
			// May or may not contain inline section depending on spec
		});

		it("should generate schemas sorted alphabetically", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: inlineSchemaApiPath,
				output: "test-output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const schemasString = generator.generateSchemasString();

			// Extract inline schema names
			const inlineSchemaMatches = schemasString.match(/export const (\w+ResponseSchema)/g);
			if (inlineSchemaMatches && inlineSchemaMatches.length > 1) {
				const sortedNames = [...inlineSchemaMatches].sort();
				// Names should appear in sorted order
				expect(inlineSchemaMatches).toEqual(sortedNames);
			}
		});
	});
});
