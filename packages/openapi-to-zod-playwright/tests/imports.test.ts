import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Imports", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	it("should not include Playwright imports in schemas-only output", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
		});

		const output = generator.generateSchemasString();

		// Schemas should not have Playwright imports
		expect(output).not.toContain('import type { APIRequestContext, APIResponse } from "@playwright/test"');
		expect(output).not.toContain('import { expect } from "@playwright/test"');
	});

	it("should include Zod import", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
		});

		const output = generator.generateSchemasString();
		expect(output).toContain('import { z } from "zod"');
	});

	it("should organize imports correctly", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
		});

		const output = generator.generateSchemasString();

		// Imports should be at the top
		const lines = output.split("\n");
		const firstImportIndex = lines.findIndex(line => line.startsWith("import"));
		const firstNonImportIndex = lines.findIndex(
			(line, index) => index > firstImportIndex && !line.startsWith("import") && line.trim() !== ""
		);

		expect(firstImportIndex).toBeGreaterThanOrEqual(0);
		expect(firstNonImportIndex).toBeGreaterThan(firstImportIndex);
	});

	it("should include Playwright imports in client file", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
		});

		const clientString = generator.generateClientString();

		// Client should reference Playwright types (imports added by generateClientFile)
		expect(clientString).toContain("APIRequestContext");
		expect(clientString).toContain("APIResponse");
	});

	it("should include proper imports in split files", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
		});

		const clientString = generator.generateClientString();
		const schemasString = generator.generateSchemasString();

		// Client should import Playwright types
		expect(clientString).toContain("APIRequestContext");

		// Schemas should import Zod
		expect(schemasString).toContain('import { z } from "zod"');
	});
});
