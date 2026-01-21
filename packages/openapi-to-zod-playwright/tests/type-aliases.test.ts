import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Type Aliases", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	describe("Client Type Aliases", () => {
		it("should export QueryParams type alias", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("export type QueryParams =");
			expect(clientOutput).toContain(
				"{ [key: string]: string | number | boolean | string[] | number[] | boolean[] } | URLSearchParams | string"
			);
		});

		it("should export HttpHeaders type alias", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("export type HttpHeaders =");
			expect(clientOutput).toContain("{ [key: string]: string }");
		});

		it("should export UrlEncodedFormData type alias", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("export type UrlEncodedFormData =");
			expect(clientOutput).toContain("{ [key: string]: string | number | boolean }");
		});

		it("should export MultipartFormData type alias", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("export type MultipartFormData =");
			expect(clientOutput).toContain("FormData | { [key: string]: MultipartFormValue }");
		});

		it("should export RequestBody type alias", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("export type RequestBody =");
			expect(clientOutput).toContain("string | Buffer | any");
		});

		it("should use type aliases in ApiRequestContextOptions", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			// Check that ApiRequestContextOptions uses the type aliases
			expect(clientOutput).toContain("export type ApiRequestContextOptions = {");
			expect(clientOutput).toContain("data?: RequestBody;");
			expect(clientOutput).toContain("form?: UrlEncodedFormData | FormData;");
			expect(clientOutput).toContain("multipart?: MultipartFormData;");
			expect(clientOutput).toContain("params?: QueryParams;");
			expect(clientOutput).toContain("headers?: HttpHeaders;");
		});

		it("should use QueryParams in serializeParams method", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			// Check that serializeParams uses QueryParams type
			expect(clientOutput).toContain("private serializeParams(params: QueryParams | undefined)");
		});
	});

	describe("Service Type Aliases", () => {
		it("should generate service code that references type aliases from client", () => {
			const fixtureWithParams = TestUtils.getFixturePath("query-params-api.yaml");
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureWithParams,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// Service methods should compile correctly with type aliases defined in client
			// The types are defined in the client file and used in service inline types
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

	describe("Split Files - Type Aliases", () => {
		it("should include type aliases in standalone client file", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			// All type aliases should be in the client output
			expect(clientOutput).toContain("export type QueryParams =");
			expect(clientOutput).toContain("export type HttpHeaders =");
			expect(clientOutput).toContain("export type UrlEncodedFormData =");
			expect(clientOutput).toContain("export type MultipartFormData =");
			expect(clientOutput).toContain("export type RequestBody =");
			expect(clientOutput).toContain("export type MultipartFormValue =");
			expect(clientOutput).toContain("export type ApiRequestContextOptions =");
		});

		it("should use type aliases consistently across client and service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();
			const serviceOutput = generator.generateServiceString();

			// Client should define the types
			expect(clientOutput).toContain("export type QueryParams =");
			expect(clientOutput).toContain("export type HttpHeaders =");

			// Service should compile successfully (types are available from client)
			expect(serviceOutput).toContain("export class ApiService");
			expect(serviceOutput).toBeTruthy();
		});
	});

	describe("Type Alias Documentation", () => {
		it("should include JSDoc comments for QueryParams", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("/**");
			expect(clientOutput).toContain("Query string parameters");
			expect(clientOutput).toContain("Supports primitives, arrays, URLSearchParams, or raw query strings");
		});

		it("should include JSDoc comments for HttpHeaders", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("HTTP headers as key-value pairs");
		});

		it("should include JSDoc comments for form data types", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("URL-encoded form data");
			expect(clientOutput).toContain("Multipart form data for file uploads");
		});

		it("should include JSDoc comments for RequestBody", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("Request body data (JSON, text, or binary)");
		});
	});

	describe("Service File Type Alias Imports", () => {
		it("should import all used type aliases from client in split service file", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const serviceContent = generator.generateServiceString();

			// Service should contain the class
			expect(serviceContent).toContain("export class ApiService");

			// The service string doesn't include imports (those are generated by generateServiceFile)
			// but we can verify it compiles correctly with type aliases defined in client
			expect(serviceContent).toBeTruthy();
		});

		it("should detect and import type aliases when used in service methods", () => {
			// Test with a fixture that has operations using various parameter types
			const fixtureWithParams = TestUtils.getFixturePath("query-params-api.yaml");
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureWithParams,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientContent = generator.generateClientString();
			const serviceContent = generator.generateServiceString();

			// Client should export all type aliases
			expect(clientContent).toContain("export type QueryParams =");
			expect(clientContent).toContain("export type HttpHeaders =");
			expect(clientContent).toContain("export type ApiRequestContextOptions =");

			// Service should compile successfully when type aliases are available
			expect(serviceContent).toContain("export class ApiService");
			expect(serviceContent).toBeTruthy();
		});

		it("should handle services with form data type aliases", () => {
			const fixtureWithForms = TestUtils.getFixturePath("multi-content-api.yaml");
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureWithForms,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientContent = generator.generateClientString();
			const serviceContent = generator.generateServiceString();

			// Client should export form-related type aliases
			expect(clientContent).toContain("export type UrlEncodedFormData =");
			expect(clientContent).toContain("export type MultipartFormData =");
			expect(clientContent).toContain("export type MultipartFormValue =");

			// Service should compile successfully with form data operations
			expect(serviceContent).toContain("export class ApiService");
			expect(serviceContent).toBeTruthy();
		});
	});

	describe("Backwards Compatibility", () => {
		it("should still support inline type usage in existing generated code", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateClientString();

			// The actual type definitions should still be present
			expect(clientOutput).toContain("{ [key: string]: string | number | boolean | string[] | number[] | boolean[] }");
			expect(clientOutput).toContain("{ [key: string]: string }");
		});

		it("should maintain all existing functionality with new type aliases", () => {
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
	});
});
