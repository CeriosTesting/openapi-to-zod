import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { PlaywrightGenerator } from "../../src/playwright-generator";
import type { PlaywrightGeneratorOptions } from "../../src/types";

export const outputDir = path.join(__dirname, "..", "output");
export const fixturesDir = path.join(__dirname, "..", "fixtures");

/**
 * Utility functions for testing the Playwright generator
 */
export const TestUtils = {
	getOutputPath(outputFileName: string): string {
		return path.join(outputDir, outputFileName);
	},

	getFixturePath(fixtureName: string): string {
		return path.join(fixturesDir, fixtureName);
	},

	cleanupTestOutput(outputFileName: string): () => void {
		return () => {
			const outputFilePath = this.getOutputPath(outputFileName);
			if (existsSync(outputFilePath)) {
				unlinkSync(outputFilePath);
			}
		};
	},

	/**
	 * Generate Playwright client code from a fixture file
	 * @param fixtureName - Name of the fixture file in the fixtures directory
	 * @param options - Partial generator options to merge with defaults
	 * @returns Generated Playwright client string
	 */
	generateClient(fixtureName: string, options?: Partial<PlaywrightGeneratorOptions>): string {
		const generator = new PlaywrightGenerator({
			input: this.getFixturePath(fixtureName),
			...options,
		});
		return generator.generateString();
	},
} as const;
