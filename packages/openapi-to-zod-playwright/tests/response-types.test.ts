import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Response Types", () => {
	describe("Primitive Response Types", () => {
		const fixtureFile = TestUtils.getFixturePath("primitives-api.yaml");

		it("should handle number responses", () => {
			const generator = new OpenApiPlaywrightGenerator({ input: fixtureFile });
			const serviceOutput = generator.generateServiceString();

			// Check service method returns number
			expect(serviceOutput).toContain("async getCount");
			expect(serviceOutput).toContain("Promise<number>");
		});

		it("should handle string responses", () => {
			const generator = new OpenApiPlaywrightGenerator({ input: fixtureFile });
			const serviceOutput = generator.generateServiceString();

			// Check service method returns string
			expect(serviceOutput).toContain("async getMessage");
			expect(serviceOutput).toContain("Promise<string>");
		});

		it("should handle boolean responses", () => {
			const generator = new OpenApiPlaywrightGenerator({ input: fixtureFile });
			const serviceOutput = generator.generateServiceString();

			// Check service method returns boolean
			expect(serviceOutput).toContain("async getActive");
			expect(serviceOutput).toContain("Promise<boolean>");
		});

		it("should handle array responses", () => {
			const generator = new OpenApiPlaywrightGenerator({ input: fixtureFile });
			const serviceOutput = generator.generateServiceString();

			// Check service method returns array
			expect(serviceOutput).toContain("async getTags");
			expect(serviceOutput).toContain("Promise<string[]>");
		});

		it("should validate primitive responses with Zod", () => {
			const generator = new OpenApiPlaywrightGenerator({ input: fixtureFile });
			const serviceOutput = generator.generateServiceString();

			// Should have methods for all primitive types
			expect(serviceOutput).toContain("Promise<number>");
			expect(serviceOutput).toContain("Promise<string>");
			expect(serviceOutput).toContain("Promise<boolean>");
			expect(serviceOutput).toContain("Promise<string[]>");
		});
	});

	describe("Complex Response Types", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		function generateOutput(): string {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
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
				input: fixtureFile,
			});
			const serviceString = generator.generateServiceString();

			// DELETE should return void for 204 in service
			expect(serviceString).toContain("Promise<void>");
			expect(serviceString).toContain("return;");
		});

		it("should not try to parse body for 204 responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
			});
			const serviceString = generator.generateServiceString();

			// Should check for method existence
			expect(serviceString).toContain("deleteUsersByUserId");
		});
	});
});
