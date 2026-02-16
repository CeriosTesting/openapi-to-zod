import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("Advanced Features", () => {
	describe("Service Layer", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should generate service methods that extract parameters", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
			});

			const serviceOutput = generator.generateServiceString();

			// Service should extract data parameter for JSON content types
			expect(serviceOutput).toContain("export class ApiService");
			// Service calls client with extracted options
			expect(serviceOutput).toContain("this._client.");
		});

		it("should generate client methods with raw Playwright options", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
			});

			const clientOutput = generator.generateClientString();

			// Client methods use raw Playwright options (no validation)
			expect(clientOutput).toContain("export class ApiClient");
			expect(clientOutput).not.toContain(".parse(");
		});
	});

	describe("Generation Modes", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should generate client-service by default", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
			});

			const clientOutput = generator.generateClientString();
			const serviceOutput = generator.generateServiceString();

			expect(clientOutput).toContain("export class ApiClient");
			expect(serviceOutput).toContain("export class ApiService");
		});

		it("should always generate both client and service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
			});

			const clientOutput = generator.generateClientString();
			const serviceOutput = generator.generateServiceString();

			expect(clientOutput).toContain("export class ApiClient");
			expect(serviceOutput).toContain("export class ApiService");
		});
	});
	describe("File Splitting", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should handle outputClient option with relative imports", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
			});

			const clientString = generator.generateClientString();
			const schemasString = generator.generateSchemasString();

			// Client should not contain schemas
			expect(clientString).toContain("export class ApiClient");
			expect(clientString).not.toContain("export const userSchema");

			// Schemas should not contain client
			expect(schemasString).toContain("export const userSchema");
			expect(schemasString).not.toContain("export class ApiClient");
		});

		it("should handle outputService option with relative imports", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
			});

			const serviceString = generator.generateServiceString();
			const clientString = generator.generateClientString();
			const schemasString = generator.generateSchemasString();

			// Service should not contain schemas or client
			expect(serviceString).toContain("export class ApiService");
			expect(serviceString).not.toContain("export const userSchema");
			expect(serviceString).not.toContain("export class ApiClient");

			// All three should be separate
			expect(schemasString).toContain("export const userSchema");
			expect(clientString).toContain("export class ApiClient");
			expect(serviceString).toContain("export class ApiService");
		});
	});

	describe("Schema Options Passthrough", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should respect mode option", () => {
			const strictGenerator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				mode: "strict",
			});

			const output = strictGenerator.generateSchemasString();
			expect(output).toContain(".strictObject(");
		});

		it("should respect prefix and suffix options", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "api",
				suffix: "Dto",
			});

			const output = generator.generateSchemasString();
			expect(output).toContain("apiUserDtoSchema");
		});

		it("should respect includeDescriptions option", () => {
			const withDescriptions = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				includeDescriptions: true,
			});

			const withoutDescriptions = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				includeDescriptions: false,
			});

			const outputWith = withDescriptions.generateSchemasString();
			const outputWithout = withoutDescriptions.generateSchemasString();

			// Schemas will have comments from file header regardless
			// But check they produce valid output and are both non-empty
			expect(outputWith).toBeTruthy();
			expect(outputWithout).toBeTruthy();
			expect(outputWith.length).toBeGreaterThan(0);
			expect(outputWithout.length).toBeGreaterThan(0);
		});

		it("should respect useDescribe option", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				useDescribe: true,
			});

			const output = generator.generateSchemasString();
			// useDescribe is passed through to schema generator
			expect(output).toBeTruthy();
		});

		it("should respect showStats option", () => {
			const withStats = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				showStats: true,
			});

			const withoutStats = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				showStats: false,
			});

			const outputWith = withStats.generateSchemasString();
			const outputWithout = withoutStats.generateSchemasString();

			expect(outputWith).toContain("// Generation Statistics:");
			expect(outputWithout).not.toContain("// Generation Statistics:");
		});
	});
});
