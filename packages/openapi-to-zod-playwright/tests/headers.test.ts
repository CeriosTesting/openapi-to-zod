import { describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Headers", () => {
	const fixtureFile = TestUtils.getFixturePath("headers-api.yaml");

	function generateOutput(): string {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});
		return generator.generateString();
	}

	it("should include headers option in client methods", () => {
		const output = generateOutput();

		// Client uses raw Playwright options which include headers
		expect(output).toContain("headers?:");
	});

	it("should handle optional headers", () => {
		const output = generateOutput();

		// Headers are in the unified options parameter
		expect(output).toContain("options?:");
		expect(output).toContain("headers?:");
	});

	it("should use raw Playwright options with headers", () => {
		const output = generateOutput();

		// Client should define ApiRequestContextOptions type with headers
		expect(output).toContain("export type ApiRequestContextOptions");
		expect(output).toContain("headers?:");

		// Client methods should use ApiRequestContextOptions
		const clientSection = output.substring(
			output.indexOf("export class ApiClient"),
			output.lastIndexOf("export class")
		);
		expect(clientSection).toContain("options?: ApiRequestContextOptions");
	});

	it("should generate methods for endpoints with headers", () => {
		const output = generateOutput();

		expect(output).toContain("async getUsers(");
		expect(output).toContain("async postSecure(");
	});

	it("should pass headers through to Playwright", () => {
		const output = generateOutput();

		// Headers are part of the raw Playwright options
		expect(output).toContain("headers?:");
	});
});
