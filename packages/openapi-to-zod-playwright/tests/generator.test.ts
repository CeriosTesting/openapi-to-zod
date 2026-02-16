import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("OpenApiPlaywrightGenerator", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	it("should generate schemas, client, and service classes", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");
		const generator = new OpenApiPlaywrightGenerator({
			useOperationId: false,
			input: fixtureFile,
			outputTypes: "api-service.ts",
			outputClient: "api-client.ts",
		});

		const schemasOutput = generator.generateSchemasString();
		const clientOutput = generator.generateClientString();
		const serviceOutput = generator.generateServiceString();

		// Check for Zod schemas
		expect(schemasOutput).toContain("export const userSchema");
		expect(schemasOutput).toContain("export const createUserRequestSchema");
		expect(schemasOutput).toContain("export const errorSchema");

		// Check for Playwright imports in client
		expect(clientOutput).toContain("APIRequestContext");
		expect(clientOutput).toContain("APIResponse");

		// Check for Playwright imports in service
		expect(serviceOutput).toContain("expect");

		// Check for Zod import (in schemas section)
		expect(schemasOutput).toContain('import { z } from "zod"');

		// Check for ApiClient class
		expect(clientOutput).toContain("export class ApiClient");
		expect(clientOutput).toContain("constructor(private readonly request: APIRequestContext)");

		// Check for ApiService class
		expect(serviceOutput).toContain("export class ApiService");
		expect(serviceOutput).toContain("constructor(private readonly _client: ApiClient)");
	});

	it("should generate client methods with correct names", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");
		const generator = new OpenApiPlaywrightGenerator({
			useOperationId: false,
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
		});
		const clientOutput = generator.generateClientString();

		// Check client method names
		expect(clientOutput).toContain("async getUsers(");
		expect(clientOutput).toContain("async postUsers(");
		expect(clientOutput).toContain("async getUsersByUserId(userId: string");
		expect(clientOutput).toContain("async deleteUsersByUserId(userId: string");
	});

	it("should generate service methods with content-type handling", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");
		const generator = new OpenApiPlaywrightGenerator({
			useOperationId: false,
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
		});
		const serviceOutput = generator.generateServiceString();

		// Service methods should exist
		expect(serviceOutput).toContain("async getUsers");
		expect(serviceOutput).toContain("async postUsers");
		expect(serviceOutput).toContain("async getUsersByUserId");
		expect(serviceOutput).toContain("async deleteUsersByUserId");

		// Service methods call client
		expect(serviceOutput).toContain("this._client.");
	});

	it("should use expect for status validation", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");
		const generator = new OpenApiPlaywrightGenerator({
			useOperationId: false,
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
		});
		const serviceOutput = generator.generateServiceString();

		// Check for Playwright expect usage
		expect(serviceOutput).toContain("expect(response.status(), await response.text()).toBe(200)");
		expect(serviceOutput).toContain("expect(response.status(), await response.text()).toBe(201)");
		expect(serviceOutput).toContain("expect(response.status(), await response.text()).toBe(204)");
	});

	it("should return void for 204 responses", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");
		const generator = new OpenApiPlaywrightGenerator({
			useOperationId: false,
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
		});
		const serviceOutput = generator.generateServiceString();

		// DELETE returns 204 with void
		expect(serviceOutput).toContain("async deleteUsersByUserId(userId: string): Promise<void>");
		// Void methods should not have unnecessary return; statements
		expect(serviceOutput).not.toContain("return;");
	});

	it("should use raw Playwright options in client methods", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");
		const generator = new OpenApiPlaywrightGenerator({
			useOperationId: false,
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
		});
		const clientOutput = generator.generateClientString();

		// Client methods should use raw Playwright options
		expect(clientOutput).toContain("options?:");
		expect(clientOutput).toContain("async postUsers(");
	});

	describe("String Generation Methods", () => {
		it("should generate schemas as string without writing to file", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const schemasString = generator.generateSchemasString();

			// Should contain Zod schemas
			expect(schemasString).toContain("export const userSchema");
			expect(schemasString).toContain("export const createUserRequestSchema");
			expect(schemasString).toContain('import { z } from "zod"');

			// Should NOT contain client or service classes
			expect(schemasString).not.toContain("export class ApiClient");
			expect(schemasString).not.toContain("export class ApiService");
		});

		it("should generate client class as string", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
			});

			const clientString = generator.generateClientString();

			// Should contain ApiClient class
			expect(clientString).toContain("export class ApiClient");
			expect(clientString).toContain("constructor(private readonly request: APIRequestContext)");
			expect(clientString).toContain("async getUsers(");

			// Should NOT contain schemas or service class
			expect(clientString).not.toContain("export const userSchema");
			expect(clientString).not.toContain("export class ApiService");
		});

		it("should generate service class as string", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
			});

			const serviceString = generator.generateServiceString();

			// Should contain ApiService class
			expect(serviceString).toContain("export class ApiService");
			expect(serviceString).toContain("constructor(private readonly _client: ApiClient)");

			// Should NOT contain schemas or client class
			expect(serviceString).not.toContain("export const userSchema");
			expect(serviceString).not.toContain("export class ApiClient");
		});

		it("should generate schemas-only output as string", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const completeString = generator.generateSchemasString();

			// Should contain schemas and types only
			expect(completeString).toContain("export const userSchema");
			expect(completeString).toContain('import { z } from "zod"');
			// Should NOT contain client or service
			expect(completeString).not.toContain('import type { APIRequestContext, APIResponse } from "@playwright/test"');
			expect(completeString).not.toContain("export class ApiClient");
			expect(completeString).not.toContain("export class ApiService");
		});

		it("should work without output path when using string methods", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			// All string methods should work
			const schemas = generator.generateSchemasString();
			const client = generator.generateClientString();
			const service = generator.generateServiceString();
			const complete = generator.generateSchemasString();

			expect(schemas).toBeTruthy();
			expect(client).toBeTruthy();
			expect(service).toBeTruthy();
			expect(complete).toBeTruthy();
		});
	});

	describe("Error Handling", () => {
		it("should throw FileOperationError for non-existent input file", () => {
			expect(() => {
				new OpenApiPlaywrightGenerator({
					useOperationId: false,
					input: TestUtils.getFixturePath("non-existent.yaml"),
					outputTypes: TestUtils.getOutputPath("test.ts"),
					outputClient: "client.ts",
				});
			}).toThrow(/Input file not found/);
		});

		it("should throw FileOperationError for missing input path", () => {
			expect(() => {
				new OpenApiPlaywrightGenerator({
					useOperationId: false,
					input: "",
					outputTypes: TestUtils.getOutputPath("test.ts"),
					outputClient: "client.ts",
				});
			}).toThrow(/Input path is required/);
		});

		it("should throw SpecValidationError for invalid YAML", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: TestUtils.getZodFixturePath("invalid-yaml.yaml"),
				outputTypes: TestUtils.getOutputPath("test.ts"),
				outputClient: "client.ts",
			});

			expect(() => generator.generateSchemasString()).toThrow(/Failed to parse OpenAPI specification/);
		});
	});

	describe("JSON Format Support", () => {
		it("should parse JSON files identically to YAML files", () => {
			const yamlGenerator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: TestUtils.getFixturePath("simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				showStats: false,
			});
			const jsonGenerator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: TestUtils.getFixturePath("simple-api.json"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				showStats: false,
			});

			const yamlSchemas = yamlGenerator.generateSchemasString();
			const jsonSchemas = jsonGenerator.generateSchemasString();

			const yamlClient = yamlGenerator.generateClientString();
			const jsonClient = jsonGenerator.generateClientString();

			const yamlService = yamlGenerator.generateServiceString();
			const jsonService = jsonGenerator.generateServiceString();

			// All outputs should be identical
			expect(jsonSchemas).toBe(yamlSchemas);
			expect(jsonClient).toBe(yamlClient);
			expect(jsonService).toBe(yamlService);
		});

		it("should throw error for invalid JSON files", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: TestUtils.getZodFixturePath("invalid-json.txt"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			expect(() => generator.generateSchemasString()).toThrow(/Failed to parse OpenAPI specification/);
		});
	});
});
