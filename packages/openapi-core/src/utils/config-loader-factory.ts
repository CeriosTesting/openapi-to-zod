/**
 * Configuration loader factory for OpenAPI generators
 *
 * Provides a generic factory to create type-safe config loaders
 * for any OpenAPI generator package.
 */

import { type CosmiconfigResult, cosmiconfig } from "cosmiconfig";
import { z } from "zod";

import { ConfigValidationError } from "../errors";

import { type FormatZodErrorsOptions, formatConfigValidationError } from "./config-validation";
import { createTypeScriptLoader } from "./typescript-loader";

export interface ConfigLoaderOptions {
	/**
	 * The package name used for config file discovery
	 * e.g., "openapi-to-zod" will search for openapi-to-zod.config.ts
	 */
	packageName: string;

	/**
	 * Additional search places beyond the defaults
	 * Defaults: [{packageName}.config.ts, {packageName}.config.json, package.json]
	 */
	additionalSearchPlaces?: string[];

	/**
	 * Custom error message options for validation errors
	 * Allows packages to provide user-friendly messages for specific fields
	 */
	errorMessages?: FormatZodErrorsOptions;
}

export interface ConfigLoader<TConfig> {
	/**
	 * Load and validate configuration from file
	 * @param configPath - Optional explicit path to config file
	 * @returns Validated configuration object
	 */
	loadConfig: (configPath?: string) => Promise<TConfig>;
}

/**
 * Create a configuration loader for an OpenAPI generator package
 *
 * @param options - Loader configuration
 * @param schema - Zod schema to validate the config file
 * @returns Configuration loader with loadConfig function
 *
 * @example
 * ```typescript
 * const { loadConfig } = createConfigLoader(
 *   {
 *     packageName: "openapi-to-zod",
 *     errorMessages: {
 *       missingFieldMessages: {
 *         outputTypes: "Each spec must specify an output file path for generated types.",
 *       },
 *       unrecognizedKeyMessages: {
 *         output: "Did you mean 'outputTypes'? The 'output' field was renamed.",
 *       },
 *       requiredFieldsHelp: "All required fields are present (specs array with input/outputTypes)",
 *     },
 *   },
 *   ConfigFileSchema
 * );
 *
 * const config = await loadConfig();
 * ```
 */
export function createConfigLoader<TConfig>(
	options: ConfigLoaderOptions,
	schema: z.ZodSchema<TConfig>
): ConfigLoader<TConfig> {
	const { packageName, additionalSearchPlaces = [], errorMessages = {} } = options;

	const defaultSearchPlaces = [`${packageName}.config.ts`, `${packageName}.config.json`, "package.json"];

	const searchPlaces = [...additionalSearchPlaces, ...defaultSearchPlaces];

	async function loadConfig(configPath?: string): Promise<TConfig> {
		const explorer = cosmiconfig(packageName, {
			searchPlaces,
			loaders: {
				".ts": createTypeScriptLoader(),
			},
		});

		let result: CosmiconfigResult;

		if (configPath) {
			// Load from explicit path (overrides auto-discovery)
			result = await explorer.load(configPath);
		} else {
			// Auto-discover config file starting from cwd
			result = await explorer.search();
		}

		if (!result || !result.config) {
			const searchedFor = searchPlaces
				.filter(p => p !== "package.json")
				.concat(`package.json (${packageName} key)`)
				.join(", ");

			throw new Error(
				configPath
					? `Config file not found at: ${configPath}`
					: `No config file found. Searched for: ${searchedFor}\nRun '${packageName} init' to create a new config file.`
			);
		}

		// Strict validation using Zod schema
		try {
			const validatedConfig = schema.parse(result.config);
			return validatedConfig;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessage = formatConfigValidationError(error, result.filepath, configPath, errorMessages);
				throw new ConfigValidationError(errorMessage, result.filepath);
			}
			throw error;
		}
	}

	return { loadConfig };
}

/**
 * Merge CLI options with config options
 * CLI options have highest precedence and override config values
 *
 * @param specConfig - Configuration from config file
 * @param cliOptions - Options provided via CLI arguments
 * @returns Merged options with CLI taking precedence
 */
export function mergeCliWithConfig<T extends object>(specConfig: T, cliOptions: Partial<T>): T {
	return {
		...specConfig,
		...Object.fromEntries(Object.entries(cliOptions).filter(([_, v]) => v !== undefined)),
	} as T;
}
