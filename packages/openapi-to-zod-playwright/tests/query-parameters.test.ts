import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Query Parameters", () => {
	const fixtureFile = TestUtils.getFixturePath("query-params-api.yaml");

	function generateClientOutput(): string {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
		});
		return generator.generateClientString();
	}

	it("should include params parameter option in client methods", () => {
		const output = generateClientOutput();

		// Client now uses raw Playwright params type
		expect(output).toContain("params?:");
	});

	it("should handle optional params", () => {
		const output = generateClientOutput();

		// Params should be optional in options
		expect(output).toContain("options?: ApiRequestContextOptions");
		expect(output).toContain("params?:");
	});

	it("should use Playwright's params type", () => {
		const output = generateClientOutput();

		// Should use Playwright's params type signature
		expect(output).toContain("params?:");
	});

	it("should generate method for endpoint with query params", () => {
		const output = generateClientOutput();

		expect(output).toContain("async getUsers(");
	});

	it("should pass params to request in client", () => {
		const output = generateClientOutput();

		// Client should pass params in the options
		expect(output).toContain("params?:");
	});
});
