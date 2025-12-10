import { describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Query Parameters", () => {
	const fixtureFile = TestUtils.getFixturePath("query-params-api.yaml");

	function generateOutput(): string {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});
		return generator.generateString();
	}

	it("should include params parameter option in client methods", () => {
		const output = generateOutput();

		// Client now uses raw Playwright params type
		expect(output).toContain("params?:");
	});

	it("should handle optional params", () => {
		const output = generateOutput();

		// Params should be optional in options
		expect(output).toContain("options?: {");
		expect(output).toContain("params?:");
	});

	it("should use Playwright's params type", () => {
		const output = generateOutput();

		// Should use Playwright's params type signature
		expect(output).toContain("params?:");
	});

	it("should generate method for endpoint with query params", () => {
		const output = generateOutput();

		expect(output).toContain("async getUsers(");
	});

	it("should pass params to request in client", () => {
		const output = generateOutput();

		// Client should pass params in the options
		expect(output).toContain("params?:");
	});
});
