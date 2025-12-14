import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Schema Statistics", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	it("should NOT include statistics in schema file when showStats is false", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			showStats: false,
		});

		const schemasOutput = generator.generateSchemasString();

		// Should not contain any statistics comments
		expect(schemasOutput).not.toContain("// Statistics:");
		expect(schemasOutput).not.toContain("//   Total schemas:");
		expect(schemasOutput).not.toContain("//   Generated at:");
	});

	it("should include statistics in schema file when showStats is true", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			showStats: true,
		});

		const schemasOutput = generator.generateSchemasString();

		// Should contain statistics comments (base package uses "Generation Statistics:")
		expect(schemasOutput).toContain("// Generation Statistics:");
		expect(schemasOutput).toContain("//   Total schemas:");
		expect(schemasOutput).toContain("//   Generated at:");
	});
});
