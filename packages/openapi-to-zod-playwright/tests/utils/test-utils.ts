import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { OpenApiPlaywrightGenerator } from "../../src/openapi-playwright-generator";
import type { OpenApiPlaywrightOpenApiGeneratorOptions } from "../../src/types";

export const outputDir = path.join(__dirname, "..", "output");
export const fixturesDir = path.join(__dirname, "..", "fixtures");

/**
 * Utility functions for testing the Playwright generator
 */
export const TestUtils = {
	getOutputPath(outputFileName: string): string {
		// Normalize the filename to handle cross-platform path separators
		// This ensures backslashes in test paths work on Linux/macOS
		const normalizedFileName = outputFileName.replace(/\\/g, path.sep);
		return path.join(outputDir, normalizedFileName);
	},

	getFixturePath(fixtureName: string): string {
		const normalizedFileName = fixtureName.replace(/\\/g, path.sep);
		return path.join(fixturesDir, normalizedFileName);
	},

	getConfigPath(configFileName: string): string {
		return path.join(fixturesDir, "config-files", configFileName);
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
	generateClient(fixtureName: string, options?: Partial<OpenApiPlaywrightOpenApiGeneratorOptions>): string {
		const generator = new OpenApiPlaywrightGenerator({
			input: this.getFixturePath(fixtureName),
			...options,
		});
		return generator.generateSchemasString();
	},
} as const;
