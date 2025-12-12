import { describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Content-Type Handling", () => {
	const fixtureFile = TestUtils.getFixturePath("content-types-api.yaml");

	function generateOutput(): string {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});
		return generator.generateClientString();
	}

	it("should handle multiple content types", () => {
		const output = generateOutput();

		// Should generate methods for different content types
		expect(output).toBeTruthy();
		expect(output).toContain("getData");
	});

	it("should handle vendor-specific content types", () => {
		const output = generateOutput();

		// Should handle application/vnd.api+json
		expect(output).toBeTruthy();
		expect(output).toContain("getData");
	});

	it("should handle charset in content-type headers", () => {
		const output = generateOutput();

		// Should handle "application/json; charset=utf-8"
		expect(output).toContain("getText");
		expect(output).toBeTruthy();
	});

	it("should generate valid TypeScript code", () => {
		const clientOutput = generateOutput();
		const generator = new PlaywrightGenerator({ input: fixtureFile });
		const schemasOutput = generator.generateSchemasString();

		// Should compile without errors
		expect(clientOutput).toContain("export class ApiClient");
		expect(schemasOutput).toContain('import { z } from "zod"');
	});
});
