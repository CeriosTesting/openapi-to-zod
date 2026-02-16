import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("Prefix and Suffix in Service Generation", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	describe("Schema imports with prefix", () => {
		it("should generate schemas with correct prefix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "api",
			});

			const schemasOutput = generator.generateSchemasString();

			// Schemas should have prefix
			expect(schemasOutput).toContain("export const apiUserSchema");
			// Types should NOT have prefix
			expect(schemasOutput).toContain("export type User");
		});

		it("should reference prefixed schema names in service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "api",
			});

			const serviceOutput = generator.generateServiceString();

			// Service should reference the prefixed schema name
			expect(serviceOutput).toContain("apiUserSchema.parse");
		});
	});

	describe("Schema imports with suffix", () => {
		it("should generate schemas with correct suffix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				suffix: "Dto",
			});

			const schemasOutput = generator.generateSchemasString();

			// Schemas should have suffix
			expect(schemasOutput).toContain("export const userDtoSchema");
			// Types should NOT have suffix
			expect(schemasOutput).toContain("export type User");
		});

		it("should reference suffixed schema names in service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				suffix: "Dto",
			});

			const serviceOutput = generator.generateServiceString();

			// Service should reference the suffixed schema name
			expect(serviceOutput).toContain("userDtoSchema.parse");
		});
	});

	describe("Schema imports with prefix and suffix combined", () => {
		it("should generate schemas with both prefix and suffix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "api",
				suffix: "Dto",
			});

			const schemasOutput = generator.generateSchemasString();

			// Schemas should have both prefix and suffix
			expect(schemasOutput).toContain("export const apiUserDtoSchema");
		});

		it("should reference prefixed+suffixed schema names in service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "api",
				suffix: "Dto",
			});

			const serviceOutput = generator.generateServiceString();

			// Service should reference the prefixed+suffixed schema name
			expect(serviceOutput).toContain("apiUserDtoSchema.parse");
		});
	});

	describe("Multi-word prefix casing preservation", () => {
		it("should preserve multi-word prefix casing (apiV2)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "apiV2",
			});

			const schemasOutput = generator.generateSchemasString();
			const serviceOutput = generator.generateServiceString();

			// Schema name should preserve V2 casing
			expect(schemasOutput).toContain("export const apiV2UserSchema");
			// Service should use same schema name
			expect(serviceOutput).toContain("apiV2UserSchema.parse");
		});

		it("should preserve multi-word prefix casing (myApi)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "myApi",
			});

			const schemasOutput = generator.generateSchemasString();
			const serviceOutput = generator.generateServiceString();

			expect(schemasOutput).toContain("export const myApiUserSchema");
			expect(serviceOutput).toContain("myApiUserSchema.parse");
		});

		it("should lowercase first char of prefix for camelCase (ApiV2 -> apiV2)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "ApiV2",
			});

			const schemasOutput = generator.generateSchemasString();
			const serviceOutput = generator.generateServiceString();

			// First char should be lowercased, rest preserved
			expect(schemasOutput).toContain("export const apiV2UserSchema");
			expect(serviceOutput).toContain("apiV2UserSchema.parse");
		});
	});

	describe("Multi-word suffix casing preservation", () => {
		it("should preserve multi-word suffix casing (ResponseDto)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				suffix: "ResponseDto",
			});

			const schemasOutput = generator.generateSchemasString();
			const serviceOutput = generator.generateServiceString();

			expect(schemasOutput).toContain("export const userResponseDtoSchema");
			expect(serviceOutput).toContain("userResponseDtoSchema.parse");
		});

		it("should preserve all-caps suffix (DTO)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				suffix: "DTO",
			});

			const schemasOutput = generator.generateSchemasString();
			const serviceOutput = generator.generateServiceString();

			expect(schemasOutput).toContain("export const userDTOSchema");
			expect(serviceOutput).toContain("userDTOSchema.parse");
		});

		it("should preserve long multi-word suffix (DataTransferObject)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				suffix: "DataTransferObject",
			});

			const schemasOutput = generator.generateSchemasString();
			const serviceOutput = generator.generateServiceString();

			expect(schemasOutput).toContain("export const userDataTransferObjectSchema");
			expect(serviceOutput).toContain("userDataTransferObjectSchema.parse");
		});
	});

	describe("Combined multi-word prefix and suffix", () => {
		it("should preserve casing with both multi-word prefix and suffix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "apiV2",
				suffix: "ResponseDto",
			});

			const schemasOutput = generator.generateSchemasString();
			const serviceOutput = generator.generateServiceString();

			expect(schemasOutput).toContain("export const apiV2UserResponseDtoSchema");
			expect(serviceOutput).toContain("apiV2UserResponseDtoSchema.parse");
		});

		it("should handle prefix with suffix DTO", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "myApi",
				suffix: "DTO",
			});

			const schemasOutput = generator.generateSchemasString();
			const serviceOutput = generator.generateServiceString();

			expect(schemasOutput).toContain("export const myApiUserDTOSchema");
			expect(serviceOutput).toContain("myApiUserDTOSchema.parse");
		});
	});

	describe("Type inference (types should NOT have prefix/suffix)", () => {
		it("should use original type name with prefix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "api",
			});

			const serviceOutput = generator.generateServiceString();

			// Return type should use original type name (User), not prefixed
			expect(serviceOutput).toContain("Promise<User>");
		});

		it("should use original type name with suffix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				suffix: "Dto",
			});

			const serviceOutput = generator.generateServiceString();

			// Return type should use original type name (User), not suffixed
			expect(serviceOutput).toContain("Promise<User>");
		});

		it("should use original type name with both prefix and suffix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "apiV2",
				suffix: "ResponseDto",
			});

			const serviceOutput = generator.generateServiceString();

			// Return type should use original type name
			expect(serviceOutput).toContain("Promise<User>");
		});
	});

	describe("Inline array schemas with prefix/suffix", () => {
		it("should apply prefix to inline array schema references", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "api",
			});

			const serviceOutput = generator.generateServiceString();

			// Array schemas should reference prefixed item schema
			if (serviceOutput.includes("z.array(")) {
				expect(serviceOutput).toMatch(/z\.array\(api\w+Schema\)/);
			}
		});

		it("should apply suffix to inline array schema references", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				suffix: "Dto",
			});

			const serviceOutput = generator.generateServiceString();

			// Array schemas should reference suffixed item schema
			if (serviceOutput.includes("z.array(")) {
				expect(serviceOutput).toMatch(/z\.array\(\w+DtoSchema\)/);
			}
		});
	});
});
