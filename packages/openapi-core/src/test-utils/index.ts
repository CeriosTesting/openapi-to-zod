/**
 * Test utilities for OpenAPI testing across packages
 *
 * Provides common fixture loading helpers, assertion utilities,
 * and a factory for creating package-specific test utilities.
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

import { parse as parseYaml } from "yaml";

import type { OpenAPISpec } from "../types";

/**
 * Fixture category subdirectories
 */
export type FixtureCategory = "basic" | "references" | "composition" | "validation" | "operations";

/**
 * Root fixtures directory (shared across monorepo)
 */
const FIXTURES_ROOT = path.resolve(__dirname, "../../../../fixtures");

/**
 * Get the path to a fixture file from the shared fixtures directory
 *
 * @param category - The fixture category subdirectory
 * @param filename - The fixture filename (with extension)
 * @returns Absolute path to the fixture file
 */
export function getFixturePath(category: FixtureCategory, filename: string): string {
	return path.join(FIXTURES_ROOT, category, filename);
}

/**
 * Get the path to a fixture file (alias for getFixturePath)
 *
 * @param relativePath - Relative path from the fixtures directory (e.g., "basic/simple.yaml")
 * @returns Resolved path to the fixture file
 */
export function resolveFixture(relativePath: string): string {
	return path.join(FIXTURES_ROOT, relativePath);
}

/**
 * Load a YAML fixture file and parse it as an OpenAPI spec
 *
 * @param category - The fixture category subdirectory
 * @param filename - The fixture filename (must end with .yaml or .yml)
 * @returns Parsed OpenAPI specification
 */
export function loadYamlFixture(category: FixtureCategory, filename: string): OpenAPISpec {
	const fixturePath = getFixturePath(category, filename);
	const content = readFileSync(fixturePath, "utf-8");
	return parseYaml(content) as OpenAPISpec;
}

/**
 * Load a JSON fixture file and parse it as an OpenAPI spec
 *
 * @param category - The fixture category subdirectory
 * @param filename - The fixture filename (must end with .json)
 * @returns Parsed OpenAPI specification
 */
export function loadJsonFixture(category: FixtureCategory, filename: string): OpenAPISpec {
	const fixturePath = getFixturePath(category, filename);
	const content = readFileSync(fixturePath, "utf-8");
	return JSON.parse(content) as OpenAPISpec;
}

/**
 * Load a fixture file (auto-detects YAML or JSON based on extension)
 *
 * @param category - The fixture category subdirectory
 * @param filename - The fixture filename
 * @returns Parsed OpenAPI specification
 */
export function loadFixture(category: FixtureCategory, filename: string): OpenAPISpec {
	if (filename.endsWith(".json")) {
		return loadJsonFixture(category, filename);
	}
	return loadYamlFixture(category, filename);
}

/**
 * Load raw fixture content as string (useful for testing parsers)
 *
 * @param category - The fixture category subdirectory
 * @param filename - The fixture filename
 * @returns Raw file content as string
 */
export function loadFixtureRaw(category: FixtureCategory, filename: string): string {
	const fixturePath = getFixturePath(category, filename);
	return readFileSync(fixturePath, "utf-8");
}

/**
 * Get all schema names from an OpenAPI spec
 *
 * @param spec - The OpenAPI specification
 * @returns Array of schema names
 */
export function getSchemaNames(spec: OpenAPISpec): string[] {
	return Object.keys(spec.components?.schemas ?? {});
}

/**
 * Assert that a string contains all expected substrings
 *
 * @param content - The string to check
 * @param expected - Array of expected substrings
 * @throws Error if any substring is missing
 */
export function assertContainsAll(content: string, expected: string[]): void {
	const missing = expected.filter(s => !content.includes(s));
	if (missing.length > 0) {
		throw new Error(`Missing expected content: ${missing.join(", ")}`);
	}
}

/**
 * Assert that a string does not contain any of the forbidden substrings
 *
 * @param content - The string to check
 * @param forbidden - Array of forbidden substrings
 * @throws Error if any forbidden substring is found
 */
export function assertContainsNone(content: string, forbidden: string[]): void {
	const found = forbidden.filter(s => content.includes(s));
	if (found.length > 0) {
		throw new Error(`Found forbidden content: ${found.join(", ")}`);
	}
}

/**
 * Clean up test output files
 *
 * @param outputDir - The output directory base path
 * @param fileNames - Array of file names to clean up
 * @returns Cleanup function suitable for afterEach/afterAll hooks
 */
export function cleanupTestOutput(outputDir: string, fileNames: string[]): () => void {
	return () => {
		for (const fileName of fileNames) {
			const normalizedFileName = fileName.replace(/\\/g, path.sep);
			const filePath = path.join(outputDir, normalizedFileName);
			if (existsSync(filePath)) {
				unlinkSync(filePath);
			}
		}
	};
}

/**
 * Configuration for creating package-specific test utilities
 */
export interface TestUtilsConfig {
	/**
	 * Path to the package's test directory (typically __dirname of the test file or tests folder)
	 */
	testDir: string;

	/**
	 * Relative path from testDir to local fixtures directory (default: "fixtures")
	 */
	fixturesSubdir?: string;

	/**
	 * Relative path from testDir to output directory (default: "output")
	 */
	outputSubdir?: string;

	/**
	 * Relative path from testDir to config-files directory (default: "fixtures/config-files")
	 */
	configSubdir?: string;
}

/**
 * Base test utilities interface returned by createTestUtils
 */
export interface BaseTestUtils {
	/**
	 * Get path to a local fixture file
	 */
	getFixturePath(fixtureName: string): string;

	/**
	 * Get path to a shared core fixture file
	 */
	getCoreFixturePath(category: FixtureCategory, filename: string): string;

	/**
	 * Get path to an output file
	 */
	getOutputPath(outputFileName: string): string;

	/**
	 * Get path to a config file
	 */
	getConfigPath(configFileName: string): string;

	/**
	 * Get path to the test config directory for CLI tests
	 */
	getTestConfigDir(subPath?: string): string;

	/**
	 * Get path to a file in the dist directory
	 */
	getDistPath(distFileName: string): string;

	/**
	 * Clean up test output files
	 */
	cleanupTestOutput(fileNames: string[]): () => void;

	/**
	 * The output directory path
	 */
	readonly outputDir: string;

	/**
	 * The fixtures directory path
	 */
	readonly fixturesDir: string;
}

/**
 * Create package-specific test utilities
 *
 * @param config - Configuration for the test utilities
 * @returns Test utilities object with path helpers and cleanup functions
 *
 * @example
 * ```typescript
 * // In tests/utils/test-utils.ts
 * import { createTestUtils } from "@cerios/openapi-core/test-utils";
 * import { OpenApiGenerator } from "../../src/openapi-generator";
 *
 * const baseUtils = createTestUtils({ testDir: __dirname });
 *
 * export const TestUtils = {
 *   ...baseUtils,
 *   generateFromFixture(fixtureName: string, options?: Partial<Options>) {
 *     const generator = new OpenApiGenerator({
 *       input: baseUtils.getFixturePath(fixtureName),
 *       ...options,
 *     });
 *     return generator.generateString();
 *   },
 * };
 * ```
 */
export function createTestUtils(config: TestUtilsConfig): BaseTestUtils {
	const fixturesSubdir = config.fixturesSubdir ?? "fixtures";
	const outputSubdir = config.outputSubdir ?? "output";
	const configSubdir = config.configSubdir ?? "fixtures/config-files";

	const fixturesDir = path.join(config.testDir, fixturesSubdir);
	const outputDir = path.join(config.testDir, outputSubdir);
	const configDir = path.join(config.testDir, configSubdir);

	const normalizePath = (fileName: string): string => {
		return fileName.replace(/\\/g, path.sep);
	};

	return {
		fixturesDir,
		outputDir,

		getFixturePath(fixtureName: string): string {
			return path.join(fixturesDir, normalizePath(fixtureName));
		},

		getCoreFixturePath(category: FixtureCategory, filename: string): string {
			return path.join(FIXTURES_ROOT, category, filename);
		},

		getOutputPath(outputFileName: string): string {
			return path.join(outputDir, normalizePath(outputFileName));
		},

		getConfigPath(configFileName: string): string {
			return path.join(configDir, normalizePath(configFileName));
		},

		getTestConfigDir(subPath?: string): string {
			const baseDir = path.join(config.testDir, "cli-config-test");
			return subPath ? path.join(baseDir, subPath) : baseDir;
		},

		getDistPath(distFileName: string): string {
			// Navigate from testDir (typically tests/utils) up to package root, then to dist
			return path.join(config.testDir, "..", "..", "dist", normalizePath(distFileName));
		},

		cleanupTestOutput(fileNames: string[]): () => void {
			return cleanupTestOutput(outputDir, fileNames);
		},
	};
}
