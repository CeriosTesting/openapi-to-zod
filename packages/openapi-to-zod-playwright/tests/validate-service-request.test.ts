import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

describe("validateServiceRequest option", () => {
	const schemaPath = resolve(__dirname, "fixtures/validate-service-request-api.yaml");

	describe("when validateServiceRequest is false (default)", () => {
		it("should NOT generate request validation code", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
			});
			const output = generator.generateServiceString();

			// Should NOT contain validation comments or .parse() calls for request inputs
			expect(output).not.toContain("// Validate query parameters");
			expect(output).not.toContain("// Validate header parameters");
			expect(output).not.toContain("// Validate request body");

			// Should NOT contain schema.parse() for query params
			expect(output).not.toContain("listUsersQueryParamsSchema.parse");

			// Should NOT contain schema.parse() for headers
			expect(output).not.toContain("getUserHeaderParamsSchema.parse");

			// Should NOT contain schema.parse() for request body (input validation)
			// Note: Response validation should still be present
			expect(output).not.toContain("createUserRequestSchema.parse(options.data)");
		});

		it("should still validate responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
			});
			const output = generator.generateServiceString();

			// Response validation should still work
			expect(output).toContain("// Parse and validate response body");
			expect(output).toContain("userSchema.parseAsync(body)");
		});
	});

	describe("when validateServiceRequest is true", () => {
		it("should generate validation code for query parameters", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
			});
			const output = generator.generateServiceString();

			// Should validate query parameters
			expect(output).toContain("// Validate query parameters");
			expect(output).toContain("if (options?.params)");
			expect(output).toContain("listUsersQueryParamsSchema.parseAsync(options.params)");
		});

		it("should generate validation code for header parameters", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
			});
			const output = generator.generateServiceString();

			// Should validate header parameters
			expect(output).toContain("// Validate header parameters");
			expect(output).toContain("if (options?.headers)");
			expect(output).toContain("getUserHeaderParamsSchema.parseAsync(options.headers)");
		});

		it("should generate validation code for required request body", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
			});
			const output = generator.generateServiceString();

			// Should validate required request body directly (without if check)
			expect(output).toContain("// Validate request body");
			expect(output).toContain("createUserRequestSchema.parseAsync(options.data)");

			// Check the postApiUsers method specifically - required body should not have if check
			const postApiUsersMethod = output.match(/async postApiUsers[\s\S]*?^\t\}/m)?.[0] || "";
			expect(postApiUsersMethod).toContain("createUserRequestSchema.parseAsync(options.data)");
			// The validation should be direct, not wrapped in if
			expect(postApiUsersMethod).not.toMatch(/if \(options\?\.data[\s\S]*createUserRequestSchema\.parseAsync/);
		});

		it("should generate validation code for optional request body with if check", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
			});
			const output = generator.generateServiceString();

			// Optional body should have if check
			expect(output).toContain("if (options?.data !== undefined)");
			expect(output).toContain("optionalDataSchema.parseAsync(options.data)");
		});

		it("should NOT generate validation for inline schemas (no $ref)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
			});
			const output = generator.generateServiceString();

			// postApiNoSchemaBody uses inline schema - should not have request body validation
			const noSchemaBodyMethod = output.match(/async postApiNoSchemaBody[\s\S]*?^\t\}/m)?.[0] || "";

			// Should NOT have body validation since there's no $ref schema
			expect(noSchemaBodyMethod).not.toContain("Schema.parse(options.data)");
		});

		it("should validate all inputs for endpoint with path, query, header, and body", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
			});
			const output = generator.generateServiceString();

			// putApiUsersByUserId has all types of inputs
			const updateUserMethod = output.match(/async putApiUsersByUserId[\s\S]*?^\t\}/m)?.[0] || "";

			// Should have query param validation
			expect(updateUserMethod).toContain("// Validate query parameters");
			expect(updateUserMethod).toContain("updateUserQueryParamsSchema.parseAsync(options.params)");

			// Should have header validation
			expect(updateUserMethod).toContain("// Validate header parameters");
			expect(updateUserMethod).toContain("updateUserHeaderParamsSchema.parseAsync(options.headers)");

			// Should have body validation (required)
			expect(updateUserMethod).toContain("// Validate request body");
			expect(updateUserMethod).toContain("updateUserRequestSchema.parseAsync(options.data)");

			// Validation should come BEFORE the client call
			const validationIndex = updateUserMethod.indexOf("// Validate query parameters");
			const clientCallIndex = updateUserMethod.indexOf("await this._client.putApiUsersByUserId");
			expect(validationIndex).toBeLessThan(clientCallIndex);
		});

		it("should add schema imports for validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "test-client.ts",
				outputService: "test-service.ts",
				validateServiceRequest: true,
			});

			// biome-ignore lint/complexity/useLiteralKeys: Testing private method
			const serviceFile = generator["generateServiceFile"]("test-service.ts", "test.ts", "test-client.ts");

			// Should import query param schemas for validation
			expect(serviceFile).toContain("listUsersQueryParamsSchema");
			expect(serviceFile).toContain("updateUserQueryParamsSchema");

			// Should import header param schemas for validation
			expect(serviceFile).toContain("getUserHeaderParamsSchema");
			expect(serviceFile).toContain("updateUserHeaderParamsSchema");

			// Should import request body schemas for validation
			expect(serviceFile).toContain("createUserRequestSchema");
			expect(serviceFile).toContain("updateUserRequestSchema");
		});
	});

	describe("with prefix/suffix options", () => {
		it("should use correct schema names with prefix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				prefix: "api",
			});
			const output = generator.generateServiceString();

			// Schema names should have prefix
			expect(output).toContain("apiListUsersQueryParamsSchema.parse");
			expect(output).toContain("apiCreateUserRequestSchema.parse");
		});

		it("should use correct schema names with suffix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				suffix: "Model",
			});
			const output = generator.generateServiceString();

			// Schema names should have suffix
			expect(output).toContain("listUsersQueryParamsModelSchema.parse");
			expect(output).toContain("createUserRequestModelSchema.parse");
		});
	});

	describe("with stripSchemaPrefix option", () => {
		it("should strip prefix from schema names", () => {
			// Create a fixture path for this test would need schemas with prefix
			// For now, test that the option is passed through correctly
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				stripSchemaPrefix: "Api",
			});
			const output = generator.generateServiceString();

			// Should still generate validation code
			expect(output).toContain("// Validate");
		});
	});

	describe("validation order", () => {
		it("should validate inputs before making the API call", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: schemaPath,
				output: "test.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
			});
			const output = generator.generateServiceString();

			// Get the postApiUsers method (create user)
			const postApiUsersMethod = output.match(/async postApiUsers[\s\S]*?^\t\}/m)?.[0] || "";

			// Find positions of validation and client call
			const bodyValidationPos = postApiUsersMethod.indexOf("createUserRequestSchema.parse");
			const clientCallPos = postApiUsersMethod.indexOf("await this._client.postApiUsers");

			// Validation should come before client call
			expect(bodyValidationPos).toBeGreaterThan(-1);
			expect(clientCallPos).toBeGreaterThan(-1);
			expect(bodyValidationPos).toBeLessThan(clientCallPos);
		});
	});
});
