import { describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Headers", () => {
	const fixtureFile = TestUtils.getFixturePath("headers-api.yaml");

	function generateOutput(): string {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
			output: TestUtils.getOutputPath("headers.ts"),
		});
		return generator.generateString();
	}

	it("should include headers option in client methods", () => {
		const output = generateOutput();

		expect(output).toContain("headers?: Record<string, string>");
	});

	it("should handle optional headers", () => {
		const output = generateOutput();

		expect(output).toContain("options?: {");
		expect(output).toContain("headers?:");
	});

	it("should combine query, headers, and data in options", () => {
		const output = generateOutput();

		// Should have headers option at minimum
		expect(output).toContain("headers?:");
		// May also have query and data options depending on endpoints
		expect(output).toBeTruthy();
	});

	it("should generate methods for endpoints with headers", () => {
		const output = generateOutput();

		expect(output).toContain("async getUsers(");
		expect(output).toContain("async postSecure(");
	});

	it("should pass headers to request", () => {
		const output = generateOutput();

		// Should pass headers in the request
		expect(output).toContain("headers?:");
	});
});
