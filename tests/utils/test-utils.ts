import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { ZodSchemaGenerator } from "../../src/generator";
import type { GeneratorOptions } from "../../src/types";

/**
 * Shared test utility functions to reduce duplication across test files
 */

export interface TestGeneratorOptions extends Partial<GeneratorOptions> {
	fixture: string;
	outputPath: string;
}

/**
 * Generate schemas from a fixture file and return the output
 */
export function generateFromFixture(options: TestGeneratorOptions): string {
	const generatorOptions: GeneratorOptions = {
		input: `tests/fixtures/${options.fixture}`,
		output: options.outputPath,
		mode: options.mode || "normal",
		includeDescriptions: options.includeDescriptions,
		useDescribe: options.useDescribe,
		enumType: options.enumType,
		schemaType: options.schemaType,
		prefix: options.prefix,
		suffix: options.suffix,
	};

	const generator = new ZodSchemaGenerator(generatorOptions);
	generator.generate();

	return readFileSync(options.outputPath, "utf-8");
}

/**
 * Cleanup output file after test - useful for afterEach
 */
export function cleanupTestOutput(outputPath: string): () => void {
	return () => {
		if (existsSync(outputPath)) {
			unlinkSync(outputPath);
		}
	};
}
