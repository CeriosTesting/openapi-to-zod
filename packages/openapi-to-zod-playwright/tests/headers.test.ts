import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("Headers", () => {
	const fixtureFile = TestUtils.getFixturePath("headers-api.yaml");

	function generateOutput(): string {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
			useOperationId: false,
		});
		return generator.generateClientString();
	}

	it("should include headers option in client methods", () => {
		const output = generateOutput();

		// Client imports ApiRequestContextOptions which includes headers
		expect(output).toContain("import type { ApiRequestContextOptions");
		expect(output).toContain("options?: ApiRequestContextOptions");
	});

	it("should handle optional headers", () => {
		const output = generateOutput();

		// Headers are in the unified options parameter (from package import)
		expect(output).toContain("options?:");
		expect(output).toContain("@cerios/openapi-to-zod-playwright");
	});

	it("should use raw Playwright options with headers", () => {
		const output = generateOutput();

		// Client should import ApiRequestContextOptions type (which includes headers)
		expect(output).toContain("import type { ApiRequestContextOptions");

		// Client methods should use ApiRequestContextOptions
		expect(output).toContain("options?: ApiRequestContextOptions");
	});

	it("should generate methods for endpoints with headers", () => {
		const output = generateOutput();

		expect(output).toContain("async getUsers(");
		expect(output).toContain("async postSecure(");
	});

	it("should pass headers through to Playwright", () => {
		const output = generateOutput();

		// Headers are part of ApiRequestContextOptions (imported from package)
		expect(output).toContain("ApiRequestContextOptions");
	});

	describe("Service Layer - Typed Headers", () => {
		function generateServiceOutput(): string {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});
			return generator.generateServiceString();
		}

		it("should generate typed header parameters in service methods", () => {
			const serviceOutput = generateServiceOutput();

			// Should import header parameter types from schemas
			expect(serviceOutput).toContain("GetUsersHeaderParams");
			expect(serviceOutput).toContain("SecureEndpointHeaderParams");

			// Service methods should use typed headers in options
			expect(serviceOutput).toContain("headers?: GetUsersHeaderParams");
			expect(serviceOutput).toContain("headers?: SecureEndpointHeaderParams");
		});

		it("should keep headers optional in service methods", () => {
			const serviceOutput = generateServiceOutput();

			// Headers should always be optional (with ? marker)
			expect(serviceOutput).toContain("headers?: GetUsersHeaderParams");
			expect(serviceOutput).toContain("headers?: SecureEndpointHeaderParams");

			// Options parameter itself should be optional when only optional props
			expect(serviceOutput).toMatch(/getUsers\([^)]*options\?:/);
		});

		it("should handle mixed query and header parameters", () => {
			const serviceOutput = generateServiceOutput();

			// getUsers has both query params and headers
			// Should have both typed params and headers
			expect(serviceOutput).toContain("GetUsersQueryParams");
			expect(serviceOutput).toContain("GetUsersHeaderParams");
			expect(serviceOutput).toContain("params?: GetUsersQueryParams");
			expect(serviceOutput).toContain("headers?: GetUsersHeaderParams");
		});

		it("should handle header parameters with request body", () => {
			const serviceOutput = generateServiceOutput();

			// secureEndpoint has headers + body
			// Should have both typed headers and body in options
			expect(serviceOutput).toContain("SecureEndpointHeaderParams");
			expect(serviceOutput).toContain("headers?: SecureEndpointHeaderParams");
			expect(serviceOutput).toContain("body"); // Should also have body parameter
		});

		it("should not add runtime validation for header parameters", () => {
			const serviceOutput = generateServiceOutput();

			// Headers are compile-time types only, no .parse() calls
			expect(serviceOutput).not.toContain("GetUsersHeaderParams.parse");
			expect(serviceOutput).not.toContain("SecureEndpointHeaderParams.parse");
			expect(serviceOutput).not.toContain("getUsersHeaderParamsSchema.parse");
			expect(serviceOutput).not.toContain("SecureEndpointHeaderParamsSchema.parse");
		});
	});
});
