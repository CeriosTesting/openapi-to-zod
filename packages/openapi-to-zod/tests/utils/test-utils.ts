import { createTestUtils, type FixtureCategory } from "@cerios/openapi-core/test-utils";

import { OpenApiGenerator } from "../../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../../src/types";

// Create base test utilities using the core factory
const baseUtils = createTestUtils({
	testDir: __dirname,
	fixturesSubdir: "../fixtures",
	outputSubdir: "../output",
	configSubdir: "../fixtures/config-files",
});

/**
 * Utility functions for testing the OpenAPI to Zod generator
 */
export const TestUtils = {
	...baseUtils,

	/**
	 * Get path to the test config directory for CLI tests
	 * @param subPath - Optional sub-path within the config directory
	 * @returns Absolute path to the test config directory
	 */
	getTestConfigDir(subPath?: string): string {
		return baseUtils.getTestConfigDir(subPath);
	},

	/**
	 * Generate Zod schemas from a fixture file
	 * @param fixtureName - Name of the fixture file in the fixtures directory
	 * @param options - Partial generator options to merge with defaults
	 * @returns Generated Zod schema string
	 */
	generateFromFixture(fixtureName: string, options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: baseUtils.getFixturePath(fixtureName),
			outputTypes: "output.ts", // Default dummy path for tests using generateString()
			...options,
		});
		return generator.generateString();
	},

	/**
	 * Generate Zod schemas from a core fixture file
	 * @param category - The fixture category in openapi-core
	 * @param filename - The fixture filename
	 * @param options - Partial generator options to merge with defaults
	 * @returns Generated Zod schema string
	 */
	generateFromCoreFixture(
		category: FixtureCategory,
		filename: string,
		options?: Partial<OpenApiGeneratorOptions>
	): string {
		const generator = new OpenApiGenerator({
			input: baseUtils.getCoreFixturePath(category, filename),
			outputTypes: "output.ts",
			...options,
		});
		return generator.generateString();
	},
} as const;
