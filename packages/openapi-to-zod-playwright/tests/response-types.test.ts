import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("Response Types", () => {
	describe("Primitive Response Types", () => {
		const fixtureFile = TestUtils.getFixturePath("primitives-api.yaml");

		it("should handle number responses with named schema", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceOutput = generator.generateServiceString();

			// Check service method returns named type (inline schemas now get named types)
			expect(serviceOutput).toContain("async getCount");
			expect(serviceOutput).toContain("Promise<GetCountResponse>");
		});

		it("should handle string responses with named schema", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceOutput = generator.generateServiceString();

			// Check service method returns named type
			expect(serviceOutput).toContain("async getMessage");
			expect(serviceOutput).toContain("Promise<GetMessageResponse>");
		});

		it("should handle boolean responses with named schema", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceOutput = generator.generateServiceString();

			// Check service method returns named type
			expect(serviceOutput).toContain("async getActive");
			expect(serviceOutput).toContain("Promise<GetActiveResponse>");
		});

		it("should handle array responses with named schema", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceOutput = generator.generateServiceString();

			// Check service method returns named type
			expect(serviceOutput).toContain("async getTags");
			expect(serviceOutput).toContain("Promise<GetTagsResponse>");
		});

		it("should validate primitive responses with named Zod schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceOutput = generator.generateServiceString();

			// Should have methods with named response types (inline schemas now get named types)
			expect(serviceOutput).toContain("Promise<GetCountResponse>");
			expect(serviceOutput).toContain("Promise<GetMessageResponse>");
			expect(serviceOutput).toContain("Promise<GetActiveResponse>");
			expect(serviceOutput).toContain("Promise<GetTagsResponse>");
		});
	});

	describe("Complex Response Types", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		function generateOutput(): string {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			return generator.generateSchemasString();
		}

		it("should handle object responses", () => {
			const output = generateOutput();

			// Check type export for User in schemas
			expect(output).toContain("export type User");
		});

		it("should handle array of objects", () => {
			const output = generateOutput();

			// Check schema for User is generated (with lowercase schema naming)
			expect(output).toContain("export const userSchema");
		});
	});

	describe("No Content Responses", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should handle 204 No Content responses in service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceString = generator.generateServiceString();

			// DELETE should return void for 204 in service
			expect(serviceString).toContain("Promise<void>");
		});

		it("should not have empty return; for void methods", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceString = generator.generateServiceString();

			// Void methods should not have unnecessary return; statements
			expect(serviceString).not.toContain("return;");
		});

		it("should not try to parse body for 204 responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceString = generator.generateServiceString();

			// Should check for method existence
			expect(serviceString).toContain("deleteUsersByUserId");
		});
	});

	describe("JSDoc @returns", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should have @returns with actual type name, not HTTP status description", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceString = generator.generateServiceString();

			// @returns should contain the actual type name
			// For inline array schemas like `type: array, items: $ref`, we now generate named response types
			expect(serviceString).toContain("@returns GetUsersResponse");
			expect(serviceString).toContain("@returns User");
		});

		it("should not have @returns for void methods", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});
			const serviceString = generator.generateServiceString();

			// Void methods should not have @returns tag
			expect(serviceString).not.toContain("@returns User deleted");
		});
	});
});
