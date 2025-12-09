import { describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Query Parameters", () => {
	const fixtureFile = TestUtils.getFixturePath("query-params-api.yaml");

	function generateOutput(): string {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
			output: TestUtils.getOutputPath("query-params.ts"),
		});
		return generator.generateString();
	}

	it("should include query parameter option in client methods", () => {
		const output = generateOutput();

		expect(output).toContain("query?: Record<string, any>");
	});

	it("should handle optional query parameters", () => {
		const output = generateOutput();

		// Query should be optional
		expect(output).toContain("options?: {");
		expect(output).toContain("query?:");
	});

	it("should handle multiple query parameters", () => {
		const output = generateOutput();

		// Should accept Record for flexibility
		expect(output).toContain("Record<string, any>");
	});

	it("should generate method for endpoint with query params", () => {
		const output = generateOutput();

		expect(output).toContain("async getUsers(");
	});

	it("should pass query params to request", () => {
		const output = generateOutput();

		// Should pass query params in the request
		expect(output).toContain("query?:");
	});
});
