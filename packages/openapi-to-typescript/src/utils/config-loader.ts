/**
 * Configuration loader for openapi-to-typescript
 *
 * Supports: openapi-to-typescript.config.{ts,json}, package.json under "openapi-to-typescript" key
 */

import {
	BaseDefaultsSchema,
	BaseGeneratorOptionsSchema,
	mergeCliWithConfig as coreMergeCliWithConfig,
	createConfigLoader,
	ExecutionModeSchema,
	type FormatZodErrorsOptions,
} from "@cerios/openapi-core";
import { z } from "zod";

import type { ConfigFile, TypeScriptGeneratorOptions } from "../types";

/**
 * TypeScript-specific options schema
 */
export const TypeScriptSpecificOptionsSchema = z.strictObject({
	enumFormat: z.enum(["enum", "union", "const-object"]).optional(),
	includeSchemas: z.array(z.string()).optional(),
	excludeSchemas: z.array(z.string()).optional(),
});

/**
 * Full generator options schema - base + TypeScript-specific
 * Uses .extend() instead of deprecated .merge() for Zod v4 compatibility
 */
export const TypeScriptGeneratorOptionsSchema = BaseGeneratorOptionsSchema.extend({
	...TypeScriptSpecificOptionsSchema.shape,
	outputTypes: z.string(), // Make outputTypes required for TypeScript generator
});

/**
 * Defaults schema - base defaults + TypeScript-specific options
 * Uses .extend() instead of deprecated .merge() for Zod v4 compatibility
 */
export const TypeScriptDefaultsSchema = BaseDefaultsSchema.extend({
	...TypeScriptSpecificOptionsSchema.shape,
});

/**
 * Config file schema
 */
const ConfigFileSchema = z.strictObject({
	defaults: TypeScriptDefaultsSchema.optional(),
	specs: z.array(TypeScriptGeneratorOptionsSchema).min(1, {
		message:
			"Configuration must include at least one specification. Each specification should have 'input' and 'outputTypes' paths.",
	}),
	executionMode: ExecutionModeSchema.optional(),
});

// Custom error messages for user-friendly validation errors
const errorMessages: FormatZodErrorsOptions = {
	missingFieldMessages: {
		input: "Each spec must specify the path to your OpenAPI specification file.",
		outputTypes: "Each spec must specify an output file path for generated TypeScript types.",
	},
	unrecognizedKeyMessages: {
		output: "Did you mean 'outputTypes'? The 'output' field was renamed to 'outputTypes'.",
	},
	requiredFieldsHelp: "All required fields are present (specs array with input/outputTypes)",
};

// Create config loader using factory from core
const configLoader = createConfigLoader<ConfigFile>(
	{
		packageName: "openapi-to-typescript",
		errorMessages,
	},
	ConfigFileSchema
);

/**
 * Load and validate configuration file
 * Supports: openapi-to-typescript.config.{ts,json}, package.json under "openapi-to-typescript" key
 *
 * @param configPath - Optional explicit path to config file. If not provided, searches automatically
 * @returns Validated ConfigFile object
 * @throws Error if config file not found, invalid, or contains unknown properties
 */
export const loadConfig = configLoader.loadConfig;

/**
 * Merge global defaults with per-spec configuration
 * CLI arguments have highest precedence and are merged separately in CLI layer
 *
 * @param config - Validated configuration file
 * @returns Array of fully resolved TypeScriptGeneratorOptions objects
 */
export function mergeConfigWithDefaults(config: ConfigFile): TypeScriptGeneratorOptions[] {
	if (!config?.specs || !Array.isArray(config.specs)) {
		throw new Error("Invalid config: specs array is required");
	}

	const defaults = config.defaults || {};

	return config.specs.map(spec => {
		// Deep merge: spec options override defaults
		const merged: TypeScriptGeneratorOptions = {
			// Apply defaults first
			enumFormat: defaults.enumFormat,
			includeDescriptions: defaults.includeDescriptions,
			defaultNullable: defaults.defaultNullable,
			useOperationId: defaults.useOperationId,
			prefix: defaults.prefix,
			suffix: defaults.suffix,
			stripSchemaPrefix: defaults.stripSchemaPrefix,
			stripPathPrefix: defaults.stripPathPrefix,
			operationFilters: defaults.operationFilters,
			showStats: defaults.showStats,
			batchSize: defaults.batchSize,

			// Override with spec-specific values (including required input/output)
			...spec,
		};
		return merged;
	});
}

/**
 * Merge CLI options with config options
 * CLI options have highest precedence and override both spec and default config
 *
 * @param specConfig - Configuration from config file (with defaults already applied)
 * @param cliOptions - Options provided via CLI arguments
 * @returns Merged TypeScriptGeneratorOptions with CLI taking precedence
 */
export function mergeCliWithConfig(
	specConfig: TypeScriptGeneratorOptions,
	cliOptions: Partial<TypeScriptGeneratorOptions>
): TypeScriptGeneratorOptions {
	return coreMergeCliWithConfig(specConfig, cliOptions);
}
