import { createTestUtils, type FixtureCategory } from "../../../../fixtures/test-utils";
import { OpenApiPlaywrightGenerator } from "../../src/openapi-playwright-generator";
import type { OpenApiPlaywrightGeneratorOptions } from "../../src/types";

// Create base test utilities using the core factory
const baseUtils = createTestUtils({
	testDir: __dirname,
	fixturesSubdir: "../fixtures",
	outputSubdir: "../output",
	configSubdir: "../fixtures/config-files",
});

// Export commonly used paths
export const outputDir = baseUtils.outputDir;
export const fixturesDir = baseUtils.fixturesDir;

/**
 * Utility functions for testing the Playwright generator
 */
export const TestUtils = {
	...baseUtils,

	/**
	 * Get path to a shared fixture from @cerios/openapi-to-zod
	 * @param filename - The fixture filename
	 * @returns Absolute path to the zod fixture
	 */
	getZodFixturePath(filename: string): string {
		// Resolve relative to the zod package's fixtures directory
		// Use dynamic require for test utilities
		// oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
		const path = require("node:path") as typeof import("node:path");
		return path.join(__dirname, "..", "..", "..", "openapi-to-zod", "tests", "fixtures", filename);
	},

	/**
	 * Generate Playwright client code from a fixture file
	 * @param fixtureName - Name of the fixture file in the fixtures directory
	 * @param options - Partial generator options to merge with defaults
	 * @returns Generated Playwright client string
	 */
	generateClient(fixtureName: string, options?: Partial<OpenApiPlaywrightGeneratorOptions>): string {
		const generator = new OpenApiPlaywrightGenerator({
			input: baseUtils.getFixturePath(fixtureName),
			outputTypes: "output.ts",
			outputClient: "client.ts",
			...options,
		});
		return generator.generateSchemasString();
	},

	/**
	 * Generate Playwright client code from a core fixture file
	 * @param category - The fixture category in openapi-core
	 * @param filename - The fixture filename
	 * @param options - Partial generator options to merge with defaults
	 * @returns Generated Playwright client string
	 */
	generateFromCoreFixture(
		category: FixtureCategory,
		filename: string,
		options?: Partial<OpenApiPlaywrightGeneratorOptions>
	): string {
		const generator = new OpenApiPlaywrightGenerator({
			input: baseUtils.getCoreFixturePath(category, filename),
			outputTypes: "output.ts",
			outputClient: "client.ts",
			...options,
		});
		return generator.generateSchemasString();
	},
} as const;
