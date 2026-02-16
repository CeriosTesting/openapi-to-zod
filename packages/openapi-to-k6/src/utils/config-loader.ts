import {
	createConfigLoader,
	ExecutionModeSchema,
	type FormatZodErrorsOptions,
	OperationFiltersSchema,
} from "@cerios/openapi-core";
import { TypeScriptDefaultsSchema, TypeScriptGeneratorOptionsSchema } from "@cerios/openapi-to-typescript";
import { z } from "zod";

import type { K6ConfigFile, OpenApiK6GeneratorOptions } from "../types";

/**
 * K6-specific options schema (beyond TypeScript options)
 */
const K6SpecificOptionsSchema = z.strictObject({
	outputClient: z.string(),
	outputService: z.string().optional(),
	operationFilters: OperationFiltersSchema.optional(),
	useOperationId: z.boolean().optional(),
	basePath: z.string().optional(),
	ignoreHeaders: z.array(z.string()).optional(),
	preferredContentTypes: z.array(z.string()).optional(),
});

/**
 * Full K6 generator options schema - TypeScript options + K6-specific
 */
const OpenApiK6GeneratorOptionsSchema = TypeScriptGeneratorOptionsSchema.omit({
	operationFilters: true, // Use K6-specific operation filters
}).extend({
	...K6SpecificOptionsSchema.shape,
});

/**
 * K6 defaults schema - TypeScript defaults + K6-specific options
 */
const K6DefaultsSchema = TypeScriptDefaultsSchema.omit({ operationFilters: true }).extend({
	...K6SpecificOptionsSchema.omit({ outputClient: true, outputService: true }).shape,
});

/**
 * K6 config file schema
 */
const K6ConfigFileSchema = z.strictObject({
	defaults: K6DefaultsSchema.optional(),
	specs: z.array(OpenApiK6GeneratorOptionsSchema).min(1, {
		message:
			"Configuration must include at least one specification. Each specification should have 'input', 'outputClient', and 'outputTypes' paths.",
	}),
	executionMode: ExecutionModeSchema.optional(),
});

// Custom error messages for user-friendly validation errors
const errorMessages: FormatZodErrorsOptions = {
	missingFieldMessages: {
		input: "Each spec must specify the path to your OpenAPI specification file.",
		outputClient: "Each spec must specify an output file path for the generated K6 API client.",
		outputTypes: "Each spec must specify an output file path for generated TypeScript types.",
	},
	unrecognizedKeyMessages: {
		output: "Did you mean 'outputClient' or 'outputTypes'? The 'output' field was renamed.",
	},
	requiredFieldsHelp: "All required fields are present (specs array with input/outputClient/outputTypes)",
};

// Create config loader using factory from core
const configLoader = createConfigLoader<K6ConfigFile>(
	{
		packageName: "openapi-to-k6",
		errorMessages,
	},
	K6ConfigFileSchema
);

/**
 * Load and validate K6 configuration file
 * Supports: openapi-to-k6.config.{ts,json}, package.json under "openapi-to-k6" key
 *
 * @param configPath - Optional explicit path to config file. If not provided, searches automatically
 * @returns Validated K6ConfigFile object
 * @throws Error if config file not found, invalid, or contains unknown properties
 */
export const loadConfig = configLoader.loadConfig;

/**
 * Merge config defaults with individual specs
 *
 * @param config - Validated K6 configuration file
 * @returns Array of fully resolved OpenApiK6GeneratorOptions objects
 */
export function mergeConfigWithDefaults(config: K6ConfigFile): OpenApiK6GeneratorOptions[] {
	if (!config?.specs || !Array.isArray(config.specs)) {
		throw new Error("Invalid config: specs array is required");
	}

	const defaults = config.defaults || {};

	return config.specs.map(spec => ({
		...defaults,
		...spec,
	}));
}
