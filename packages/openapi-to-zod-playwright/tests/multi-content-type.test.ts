import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Multi-Content-Type Support", () => {
	describe("JSON Content Type", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should generate service method for application/json", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
			});

			const serviceSection = generator.generateServiceString();

			// POST /users with JSON content type - single content type so no suffix
			expect(serviceSection).toContain("async postUsers");
		});

		it("should accept data parameter for JSON content type", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
			});

			const serviceSection = generator.generateServiceString();

			// Service method should have data in options parameter
			expect(serviceSection).toMatch(/async postUsers\w*\([^)]*options[^)]*:\s*\{[^}]*data:/);
		});

		it("should pass options to client", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
			});

			const serviceSection = generator.generateServiceString();

			// Service calls client with options
			expect(serviceSection).toContain("this.client.postUsers");
			expect(serviceSection).toMatch(/this\.client\.postUsers\([^)]*options/);
		});
	});

	describe("Form URL Encoded Content Type", () => {
		it("should generate service method for application/x-www-form-urlencoded", () => {
			const fixture = TestUtils.getFixturePath("form-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const serviceSection = generator.generateServiceString();

			// Should generate postLogin method (method+path, single content type no suffix)
			expect(serviceSection).toContain("async postLogin");
		});

		it("should accept form parameter for form-urlencoded content type", () => {
			const fixture = TestUtils.getFixturePath("form-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const serviceSection = generator.generateServiceString();

			// Service method should have form in options parameter
			expect(serviceSection).toMatch(/async postLogin\w*\([^)]*options[^)]*:\s*\{[^}]*form:/);
		});

		it("should pass options to client", () => {
			const fixture = TestUtils.getFixturePath("form-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const serviceSection = generator.generateServiceString();

			// Service calls client with options
			expect(serviceSection).toContain("this.client.postLogin");
			expect(serviceSection).toMatch(/this\.client\.postLogin\([^)]*options/);
		});
	});

	describe("Multipart Form Data Content Type", () => {
		it("should generate service method for multipart/form-data", () => {
			const fixture = TestUtils.getFixturePath("upload-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const serviceSection = generator.generateServiceString();

			// Should generate postUpload method (method+path, single content type no suffix)
			expect(serviceSection).toContain("async postUpload");
		});

		it("should accept multipart parameter for multipart/form-data", () => {
			const fixture = TestUtils.getFixturePath("upload-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const serviceSection = generator.generateServiceString();

			// Service method should have multipart in options parameter
			expect(serviceSection).toMatch(/async postUpload\w*\([^)]*options[^)]*:\s*\{[^}]*multipart:/);
		});

		it("should pass options to client", () => {
			const fixture = TestUtils.getFixturePath("upload-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const serviceSection = generator.generateServiceString();

			// Service calls client with options
			expect(serviceSection).toContain("this.client.postUpload");
			expect(serviceSection).toMatch(/this\.client\.postUpload\([^)]*options/);
		});
	});

	describe("Multiple Content Types in One Endpoint", () => {
		it("should generate separate methods for each content type", () => {
			const fixture = TestUtils.getFixturePath("multi-content-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const serviceSection = generator.generateServiceString();

			// Should generate both postUsersJson and postUsersForm with suffixes
			expect(serviceSection).toContain("async postUsersJson");
			expect(serviceSection).toContain("async postUsersForm");
		});

		it("should call the same client method from all service methods", () => {
			const fixture = TestUtils.getFixturePath("multi-content-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const clientSection = generator.generateClientString();
			const serviceSection = generator.generateServiceString();

			// Client should have one method
			expect(clientSection).toContain("async postUsers(");

			// Both service methods call the same client method
			expect(serviceSection).toContain("this.client.postUsers");
		});

		it("should pass correct parameter type for each content type", () => {
			const fixture = TestUtils.getFixturePath("multi-content-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const serviceSection = generator.generateServiceString();

			// JSON method should have data in options
			expect(serviceSection).toMatch(/async postUsersJson\w*\([^)]*options[^)]*:\s*\{[^}]*data:/);

			// Form method should have form in options
			expect(serviceSection).toMatch(/async postUsersForm\w*\([^)]*options[^)]*:\s*\{[^}]*form:/);
		});
	});

	describe("Query Parameters with Different Content Types", () => {
		it("should handle params alongside different content types", () => {
			const fixture = TestUtils.getFixturePath("params-with-body-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixture,
			});

			const serviceSection = generator.generateServiceString();

			// Service method should have both data and params in options (params is optional)
			expect(serviceSection).toContain("async postSearch(options: {");
			expect(serviceSection).toContain("params?:");
			expect(serviceSection).toContain("data:");
		});
	});

	describe("Client Passthrough", () => {
		it("should generate client with unified Playwright options", () => {
			const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
			});

			const clientSection = generator.generateClientString();

			// Should define ApiRequestContextOptions type with all properties
			expect(clientSection).toContain("export type ApiRequestContextOptions");
			expect(clientSection).toContain("data?:");
			expect(clientSection).toContain("form?:");
			expect(clientSection).toContain("multipart?:");
			expect(clientSection).toContain("params?:");
			expect(clientSection).toContain("headers?:");

			// Client methods should use the type
			expect(clientSection).toContain("options?: ApiRequestContextOptions");
		});

		it("should allow client to accept any Playwright option", () => {
			const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
			});

			const clientSection = generator.generateClientString();

			// ApiRequestContextOptions should include Playwright request options
			expect(clientSection).toContain("export type ApiRequestContextOptions");
			expect(clientSection).toContain("timeout?:");
			expect(clientSection).toContain("failOnStatusCode?:");

			// Client methods should use the type
			expect(clientSection).toContain("options?: ApiRequestContextOptions");
		});
	});
});
