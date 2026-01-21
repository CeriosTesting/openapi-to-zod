import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Query Parameters", () => {
	const fixtureFile = TestUtils.getFixturePath("query-params-api.yaml");

	function generateClientOutput(): string {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
			useOperationId: false,
		});
		return generator.generateClientString();
	}

	it("should include params parameter option in client methods", () => {
		const output = generateClientOutput();

		// Client imports ApiRequestContextOptions which includes params
		expect(output).toContain("import type { ApiRequestContextOptions");
		expect(output).toContain("options?: ApiRequestContextOptions");
	});

	it("should handle optional params", () => {
		const output = generateClientOutput();

		// Params should be optional in options (imported from package)
		expect(output).toContain("options?: ApiRequestContextOptions");
		expect(output).toContain("@cerios/openapi-to-zod-playwright");
	});

	it("should use Playwright's params type", () => {
		const output = generateClientOutput();

		// Should use ApiRequestContextOptions type from package (which includes params)
		expect(output).toContain("ApiRequestContextOptions");
		expect(output).toContain("@cerios/openapi-to-zod-playwright");
	});

	it("should generate method for endpoint with query params", () => {
		const output = generateClientOutput();

		expect(output).toContain("async getUsers(");
	});

	it("should pass params to request in client", () => {
		const output = generateClientOutput();

		// Client should serialize params via imported function
		expect(output).toContain("serializeParams(options.params)");
	});
});
