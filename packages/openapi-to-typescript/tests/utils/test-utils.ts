import { createTestUtils, type FixtureCategory } from "../../../../fixtures/test-utils";
import type { TypeScriptGeneratorOptions } from "../../src/types";
import { TypeScriptGenerator } from "../../src/typescript-generator";

// Create base test utilities using the core factory
const baseUtils = createTestUtils({
	testDir: __dirname,
	fixturesSubdir: "../fixtures",
	outputSubdir: "../output",
	configSubdir: "../fixtures/config-files",
});

/**
 * Utility functions for testing the OpenAPI to TypeScript generator
 */
export const TestUtils = {
	...baseUtils,

	/**
	 * Generate TypeScript types from a fixture file
	 * @param fixtureName - Name of the fixture file in the fixtures directory
	 * @param options - Partial generator options to merge with defaults
	 * @returns Generated TypeScript code string
	 */
	generateFromFixture(fixtureName: string, options?: Partial<TypeScriptGeneratorOptions>): string {
		const generator = new TypeScriptGenerator({
			input: baseUtils.getFixturePath(fixtureName),
			outputTypes: "output.ts",
			...options,
		});
		return generator.generateString();
	},

	/**
	 * Generate TypeScript types from a core fixture file
	 * @param category - The fixture category in openapi-core
	 * @param filename - The fixture filename
	 * @param options - Partial generator options to merge with defaults
	 * @returns Generated TypeScript code string
	 */
	generateFromCoreFixture(
		category: FixtureCategory,
		filename: string,
		options?: Partial<TypeScriptGeneratorOptions>
	): string {
		const generator = new TypeScriptGenerator({
			input: baseUtils.getCoreFixturePath(category, filename),
			outputTypes: "output.ts",
			...options,
		});
		return generator.generateString();
	},
} as const;
