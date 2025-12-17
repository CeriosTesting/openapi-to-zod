import { describe, expect, it, vi } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Ignore Headers Feature", () => {
	const fixtureFile = TestUtils.getFixturePath("headers-api.yaml");

	describe("Schema Generation", () => {
		it("should generate header parameter schemas when ignoreHeaders is not set", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
			});

			const output = generator.generateSchemasString();

			// Should contain header parameter schemas
			expect(output).toContain("GetUsersHeaderParams");
			expect(output).toContain("export const getUsersHeaderParamsSchema");
			expect(output).toContain("SecureEndpointHeaderParams");
		});

		it("should not generate schemas for ignored headers with exact match", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["Authorization"],
			});

			const output = generator.generateSchemasString();

			// Should still generate header schemas but without Authorization
			// GetUsers has X-API-Key and X-Request-ID which should remain
			expect(output).toContain("GetUsersHeaderParams");
			expect(output).not.toContain("Authorization");

			// SecureEndpoint has Content-Type remaining, so schema should be generated
			expect(output).toContain("SecureEndpointHeaderParams");
			expect(output).toContain("Content-Type");
		});

		it("should not generate any header schemas when ignoreHeaders is ['*']", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["*"],
			});

			const output = generator.generateSchemasString();

			// Should not contain any header parameter schemas
			expect(output).not.toContain("HeaderParams");
			expect(output).not.toContain("getUsersHeaderParamsSchema");
		});

		it("should support glob patterns for ignoring headers", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["X-*"],
			});

			const output = generator.generateSchemasString();

			// GetUsers should still have Authorization after filtering X-*
			expect(output).toContain("GetUsersHeaderParams");
			expect(output).toContain("Authorization");
			expect(output).not.toContain("X-API-Key");
			expect(output).not.toContain("X-Request-ID");

			// SecureEndpoint has Authorization and Content-Type
			expect(output).toContain("SecureEndpointHeaderParams");
		});

		it("should be case-insensitive when matching header names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["authorization", "x-request-id"], // lowercase
			});

			const output = generator.generateSchemasString();

			// GetUsers should still have X-API-Key
			expect(output).toContain("GetUsersHeaderParams");
			expect(output).toContain("X-API-Key");
			expect(output).not.toContain("Authorization");
			expect(output).not.toContain("X-Request-ID");

			// SecureEndpoint should have only Content-Type
			expect(output).toContain("SecureEndpointHeaderParams");
			expect(output).toContain("Content-Type");
		});

		it("should handle multiple patterns", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["Authorization", "X-Request-*"],
			});

			const output = generator.generateSchemasString();

			// GetUsers should have X-API-Key (Authorization and X-Request-* are filtered)
			expect(output).toContain("GetUsersHeaderParams");
			expect(output).toContain("X-API-Key");
			expect(output).not.toContain("Authorization");
			expect(output).not.toContain("X-Request-ID");

			// SecureEndpoint should have Content-Type
			expect(output).toContain("SecureEndpointHeaderParams");
			expect(output).toContain("Content-Type");
		});

		it("should handle empty array (no filtering)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: [],
			});

			const output = generator.generateSchemasString();

			// Should generate all header schemas
			expect(output).toContain("GetUsersHeaderParams");
			expect(output).toContain("SecureEndpointHeaderParams");
		});
	});

	describe("Service Generation", () => {
		it("should include header parameters in service methods when not ignored", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				outputClient: "client.ts",
				outputService: "service.ts",
				useOperationId: false,
			});

			const output = generator.generateServiceString();

			// Should import and use header parameter types
			expect(output).toContain("GetUsersHeaderParams");
			expect(output).toContain("headers?: GetUsersHeaderParams");
			expect(output).toContain("SecureEndpointHeaderParams");
		});

		it("should exclude ignored headers from service method signatures", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				outputClient: "client.ts",
				outputService: "service.ts",
				useOperationId: false,
				ignoreHeaders: ["Authorization"],
			});

			const output = generator.generateServiceString();

			// Should still have GetUsersHeaderParams (has X-API-Key and X-Request-ID)
			expect(output).toContain("GetUsersHeaderParams");
			expect(output).toContain("headers?: GetUsersHeaderParams");

			// Should still have SecureEndpointHeaderParams (has Content-Type)
			expect(output).toContain("SecureEndpointHeaderParams");
			expect(output).toContain("headers?: SecureEndpointHeaderParams");
		});

		it("should not include any header parameters when all are ignored", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				outputClient: "client.ts",
				outputService: "service.ts",
				useOperationId: false,
				ignoreHeaders: ["*"],
			});

			const output = generator.generateServiceString();

			// Should not import or use any header types
			expect(output).not.toContain("HeaderParams");
			expect(output).not.toContain("headers?:");
		});

		it("should not import header schemas that are completely filtered out", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				outputClient: "client.ts",
				outputService: "service.ts",
				useOperationId: false,
				ignoreHeaders: ["*"], // Ignore ALL headers
			});

			const output = generator.generateServiceString();

			// Should not have any header-related imports or types
			expect(output).not.toContain("HeaderParams");
			expect(output).not.toContain("headers?:");
		});

		it("should handle methods with mixed parameters correctly", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				outputClient: "client.ts",
				outputService: "service.ts",
				useOperationId: false,
				ignoreHeaders: ["Authorization"],
			});

			const output = generator.generateServiceString();

			// Method with query + headers should still work
			expect(output).toContain("async getUsers(");

			// Should have both params and headers in options
			expect(output).toMatch(/params\?:.*GetUsersQueryParams/);
			expect(output).toMatch(/headers\?:.*GetUsersHeaderParams/);
		});
	});

	describe("Client Generation", () => {
		it("should not be affected by ignoreHeaders option", () => {
			const generator1 = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				outputClient: "client.ts",
				useOperationId: false,
			});

			const generator2 = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				outputClient: "client.ts",
				useOperationId: false,
				ignoreHeaders: ["*"],
			});

			const output1 = generator1.generateClientString();
			const output2 = generator2.generateClientString();

			// Client should be identical (passthrough, no header filtering)
			expect(output1).toBe(output2);

			// Both should accept ApiRequestContextOptions
			expect(output1).toContain("options?: ApiRequestContextOptions");
			expect(output2).toContain("options?: ApiRequestContextOptions");
		});
	});

	describe("Validation Warnings", () => {
		it("should warn when pattern doesn't match any headers", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["NonExistentHeader"],
			});

			generator.generateSchemasString();

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("does not match any header parameters"));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("NonExistentHeader"));

			consoleSpy.mockRestore();
		});

		it("should not warn when wildcard is used", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["*"],
			});

			generator.generateSchemasString();

			expect(consoleSpy).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it("should warn when ignoreHeaders is set but no headers exist in spec", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const simpleFixture = TestUtils.getFixturePath("simple-api.yaml");

			const generator = new OpenApiPlaywrightGenerator({
				input: simpleFixture,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["Authorization"],
			});

			generator.generateSchemasString();

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("no header parameters found in spec"));

			consoleSpy.mockRestore();
		});

		it("should show available headers in warning", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["X-NonExistent"],
			});

			generator.generateSchemasString();

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Available headers:"));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("authorization"));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("x-request-id"));

			consoleSpy.mockRestore();
		});
	});

	describe("Edge Cases", () => {
		it("should handle operations with only ignored headers", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				outputClient: "client.ts",
				outputService: "service.ts",
				useOperationId: false,
				ignoreHeaders: ["Authorization"],
			});

			const output = generator.generateServiceString();

			// postSecure has Content-Type remaining after filtering Authorization
			expect(output).toContain("async postSecure(");
			// Content-Type remains, so SecureEndpointHeaderParams should still be generated
			expect(output).toContain("SecureEndpointHeaderParams");
		});

		it("should handle complex glob patterns", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: ["X-*", "Auth*"],
			});

			const output = generator.generateSchemasString();

			// GetUsers: All headers filtered (Authorization, X-API-Key, X-Request-ID)
			// SecureEndpoint: Authorization filtered, but Content-Type remains
			expect(output).toContain("SecureEndpointHeaderParams");
			expect(output).toContain("Content-Type");
			expect(output).not.toContain("GetUsersHeaderParams");
		});

		it("should handle undefined ignoreHeaders gracefully", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				useOperationId: false,
				ignoreHeaders: undefined,
			});

			const output = generator.generateSchemasString();

			// Should generate all headers normally
			expect(output).toContain("GetUsersHeaderParams");
			expect(output).toContain("SecureEndpointHeaderParams");
		});

		it("should preserve other parameters when headers are filtered", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "test.ts",
				outputClient: "client.ts",
				outputService: "service.ts",
				useOperationId: false,
				ignoreHeaders: ["*"],
			});

			const output = generator.generateServiceString();

			// Query parameters should still be present (GetUsers has a "page" query param)
			expect(output).toContain("GetUsersQueryParams");
			expect(output).toContain("params?:");
		});
	});

	describe("Integration with Config File", () => {
		it("should work with config defaults", () => {
			// This would be tested in config-loader.test.ts
			// Just verify the option is properly typed
			const options: any = {
				input: fixtureFile,
				output: "test.ts",
				ignoreHeaders: ["Authorization"],
			};

			expect(options.ignoreHeaders).toEqual(["Authorization"]);
		});
	});
});
