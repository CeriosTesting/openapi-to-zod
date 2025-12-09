import { describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Imports", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	it("should include Playwright imports in single file mode", () => {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();

		expect(output).toContain('import type { APIRequestContext, APIResponse } from "@playwright/test"');
		expect(output).toContain('import { expect } from "@playwright/test"');
	});

	it("should include Zod import", () => {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();
		expect(output).toContain('import { z } from "zod"');
	});

	it("should organize imports correctly", () => {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();

		// Imports should be at the top
		const lines = output.split("\n");
		const firstImportIndex = lines.findIndex(line => line.startsWith("import"));
		const firstNonImportIndex = lines.findIndex(
			(line, index) => index > firstImportIndex && !line.startsWith("import") && line.trim() !== ""
		);

		expect(firstImportIndex).toBeGreaterThanOrEqual(0);
		expect(firstNonImportIndex).toBeGreaterThan(firstImportIndex);
	});

	it("should handle type imports vs value imports", () => {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();

		// Type imports should use "import type"
		expect(output).toContain("import type { APIRequestContext, APIResponse }");

		// Value imports should not use "import type"
		expect(output).toContain('import { expect } from "@playwright/test"');
		expect(output).toContain('import { z } from "zod"');
	});

	it("should include proper imports in split files", () => {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const clientString = generator.generateClientString();
		const schemasString = generator.generateSchemasString();

		// Client should import Playwright types
		expect(clientString).toContain("APIRequestContext");

		// Schemas should import Zod
		expect(schemasString).toContain('import { z } from "zod"');
	});
});
