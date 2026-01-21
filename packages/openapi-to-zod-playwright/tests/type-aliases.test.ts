import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Type Aliases", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	describe("Client Type Aliases - Package Imports", () => {
		it("should import types from @cerios/openapi-to-zod-playwright", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain(
				'import type { ApiRequestContextOptions } from "@cerios/openapi-to-zod-playwright"'
			);
			expect(clientOutput).toContain('import { serializeParams } from "@cerios/openapi-to-zod-playwright"');
		});

		it("should not define type aliases inline anymore", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			// Types should NOT be defined inline - they come from the package
			expect(clientOutput).not.toContain("export type QueryParams =");
			expect(clientOutput).not.toContain("export type HttpHeaders =");
			expect(clientOutput).not.toContain("export type UrlEncodedFormData =");
			expect(clientOutput).not.toContain("export type MultipartFormData =");
			expect(clientOutput).not.toContain("export type RequestBody =");
			expect(clientOutput).not.toContain("export type MultipartFormValue =");
			expect(clientOutput).not.toContain("export type ApiRequestContextOptions =");
		});

		it("should use imported serializeParams function", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			// Should use the imported function, not a private method
			expect(clientOutput).toContain("serializeParams(options.params)");
			expect(clientOutput).not.toContain("this.serializeParams");
			expect(clientOutput).not.toContain("private serializeParams");
		});

		it("should use ApiRequestContextOptions in method signatures", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			// Methods should use the imported type
			expect(clientOutput).toContain("options?: ApiRequestContextOptions");
		});
	});

	describe("Service Type Aliases - Package Imports", () => {
		it("should generate service code that works with types from package", () => {
			const fixtureWithParams = TestUtils.getFixturePath("query-params-api.yaml");
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureWithParams,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// Service methods should compile correctly with type aliases from package
			expect(serviceOutput).toContain("export class ApiService");
			expect(serviceOutput).toBeTruthy();
		});

		it("should work with multi-content-type fixture that uses form data", () => {
			const fixtureWithForms = TestUtils.getFixturePath("multi-content-api.yaml");
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureWithForms,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// Service should handle form and multipart data correctly
			expect(serviceOutput).toContain("export class ApiService");
			expect(serviceOutput).toBeTruthy();
		});
	});

	describe("Split Files - Package Imports", () => {
		it("should import types from package in client file", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			// Types should be imported from package
			expect(clientOutput).toContain("@cerios/openapi-to-zod-playwright");
		});

		it("should use types consistently across client and service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();
			const serviceOutput = generator.generateServiceString();

			// Client should import types from package
			expect(clientOutput).toContain("@cerios/openapi-to-zod-playwright");

			// Service should compile successfully
			expect(serviceOutput).toContain("export class ApiService");
			expect(serviceOutput).toBeTruthy();
		});
	});

	describe("Backwards Compatibility", () => {
		it("should maintain all existing functionality with package imports", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();
			const serviceOutput = generator.generateServiceString();

			// Both outputs should be valid and contain expected content
			expect(clientOutput).toBeTruthy();
			expect(serviceOutput).toBeTruthy();
			expect(clientOutput).toContain("export class ApiClient");
			expect(serviceOutput).toContain("export class ApiService");
		});

		it("should produce valid client class structure", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			// Should have proper structure
			expect(clientOutput).toContain("export class ApiClient");
			expect(clientOutput).toContain("constructor(private readonly request: APIRequestContext)");
			expect(clientOutput).toContain("Promise<APIResponse>");
		});
	});

	describe("Runtime Package Exports", () => {
		it("should export types from runtime module", async () => {
			// Import from the runtime module to verify exports exist
			const runtime = await import("../src/runtime");

			expect(runtime.serializeParams).toBeDefined();
			expect(typeof runtime.serializeParams).toBe("function");
		});

		it("should export zod helpers from runtime module", async () => {
			const zodHelpers = await import("../src/runtime/zod-helpers");

			expect(zodHelpers.parseWithPrettifyError).toBeDefined();
			expect(zodHelpers.parseWithPrettifyErrorWithValues).toBeDefined();
			expect(zodHelpers.formatZodErrorPath).toBeDefined();
			expect(zodHelpers.formatZodErrorWithValues).toBeDefined();
		});

		it("serializeParams should handle various input types", async () => {
			const { serializeParams } = await import("../src/runtime");

			// Test undefined
			expect(serializeParams(undefined)).toBeUndefined();

			// Test string
			expect(serializeParams("foo=bar")).toBe("foo=bar");

			// Test URLSearchParams
			const urlParams = new URLSearchParams("a=1&b=2");
			expect(serializeParams(urlParams)).toBe(urlParams);

			// Test object with primitives
			expect(serializeParams({ a: "1", b: 2, c: true })).toEqual({ a: "1", b: 2, c: true });

			// Test object with arrays (should be comma-separated)
			expect(serializeParams({ tags: ["a", "b", "c"] })).toEqual({ tags: "a,b,c" });
			expect(serializeParams({ ids: [1, 2, 3] })).toEqual({ ids: "1,2,3" });
		});
	});
});
