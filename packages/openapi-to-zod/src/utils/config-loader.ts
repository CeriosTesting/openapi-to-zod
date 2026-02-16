import {
	BaseDefaultsSchema,
	BaseGeneratorOptionsSchema,
	mergeCliWithConfig as coreMergeCliWithConfig,
	createConfigLoader,
	ExecutionModeSchema,
	type FormatZodErrorsOptions,
	RegexPatternSchema,
	RequestResponseOptionsSchema,
} from "@cerios/openapi-core";
import { z } from "zod";

import type { ConfigFile, OpenApiGeneratorOptions } from "../types";

/**
 * Zod-specific options schema - extends base generator options
 */
const ZodSpecificOptionsSchema = z.strictObject({
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	useDescribe: z.boolean().optional(),
	emptyObjectBehavior: z.enum(["strict", "loose", "record"]).optional(),
	schemaType: z.enum(["all", "request", "response"]).optional(),
	request: RequestResponseOptionsSchema.optional(),
	response: RequestResponseOptionsSchema.optional(),
	customDateTimeFormatRegex: RegexPatternSchema.optional(),
	outputZodSchemas: z.string().optional(),
	enumFormat: z.enum(["union", "const-object"]).optional(),
	typeAssertionThreshold: z.number().int().gte(0).optional(),
});

/**
 * Full generator options schema - base + Zod-specific
 * Uses .extend() instead of deprecated .merge() for Zod v4 compatibility
 */
const OpenApiGeneratorOptionsSchema = BaseGeneratorOptionsSchema.extend({
	...ZodSpecificOptionsSchema.shape,
	outputTypes: z.string().optional(),
	output: z.string().optional(),
}).superRefine((spec, ctx) => {
	const hasOutputTypes = Boolean(spec.outputTypes);
	const hasOutput = Boolean(spec.output);
	const hasOutputZodSchemas = Boolean(spec.outputZodSchemas);

	// When outputZodSchemas is specified, outputTypes is required for TypeScript types
	if (hasOutputZodSchemas && !hasOutputTypes && !hasOutput) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["outputTypes"],
			message: "When 'outputZodSchemas' is specified, 'outputTypes' is required for TypeScript type definitions.",
		});
	}

	// Standard validation when outputZodSchemas is not used
	if (!hasOutputZodSchemas && !hasOutputTypes && !hasOutput) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["outputTypes"],
			message: "Each spec must specify an output file path using 'outputTypes' (preferred) or deprecated 'output'.",
		});
	}

	if (hasOutputTypes && hasOutput && spec.outputTypes !== spec.output) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["output"],
			message: "Invalid configuration: 'outputTypes' and deprecated 'output' are both set but have different values.",
		});
	}
});

/**
 * Defaults schema - base defaults + Zod-specific options (no input/outputTypes/name)
 * Uses .extend() instead of deprecated .merge() for Zod v4 compatibility
 */
const ZodDefaultsSchema = BaseDefaultsSchema.extend({
	...ZodSpecificOptionsSchema.shape,
});

/**
 * Config file schema
 */
const ConfigFileSchema = z.strictObject({
	defaults: ZodDefaultsSchema.optional(),
	specs: z.array(OpenApiGeneratorOptionsSchema).min(1, {
		message:
			"Configuration must include at least one specification. Each specification should have 'input' and 'outputTypes' paths.",
	}),
	executionMode: ExecutionModeSchema.optional(),
});

// Custom error messages for user-friendly validation errors
const errorMessages: FormatZodErrorsOptions = {
	missingFieldMessages: {
		input: "Each spec must specify the path to your OpenAPI specification file.",
		outputTypes: "Each spec must specify an output file path for generated Zod schemas.",
	},
	unrecognizedKeyMessages: {},
	requiredFieldsHelp: "All required fields are present (specs array with input/outputTypes)",
};

// Create config loader using factory from core
const configLoader = createConfigLoader<ConfigFile>(
	{
		packageName: "openapi-to-zod",
		errorMessages,
	},
	ConfigFileSchema
);

/**
 * Load and validate configuration file
 * Supports: openapi-to-zod.config.{ts,json}, package.json under "openapi-to-zod" key
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
 * @returns Array of fully resolved OpenApiGeneratorOptions objects
 */
export function mergeConfigWithDefaults(config: ConfigFile): OpenApiGeneratorOptions[] {
	if (!config?.specs || !Array.isArray(config.specs)) {
		throw new Error("Invalid config: specs array is required");
	}

	const defaults = config.defaults || {};
	let warnedDeprecatedOutput = false;

	return config.specs.map(spec => {
		const output = spec.output;
		const outputTypes = spec.outputTypes;
		const resolvedOutputTypes = outputTypes ?? output;
		const hasOutputZodSchemas = Boolean(spec.outputZodSchemas);

		// When outputZodSchemas is specified, outputTypes is required
		if (hasOutputZodSchemas && resolvedOutputTypes === undefined) {
			throw new Error(
				"When 'outputZodSchemas' is specified, 'outputTypes' is required for TypeScript type definitions."
			);
		}

		// Standard validation when outputZodSchemas is not used
		if (!hasOutputZodSchemas && resolvedOutputTypes === undefined) {
			throw new Error("Each spec must define 'outputTypes' (preferred) or deprecated 'output'.");
		}

		if (output && outputTypes && output !== outputTypes) {
			throw new Error("Invalid configuration: 'outputTypes' and deprecated 'output' cannot have different values.");
		}

		if (output && !warnedDeprecatedOutput) {
			console.warn(
				"[openapi-to-zod] Deprecation warning: 'output' is deprecated and will be removed in a future release. Use 'outputTypes' instead."
			);
			warnedDeprecatedOutput = true;
		}

		const { output: _deprecatedOutput, ...specWithoutDeprecatedOutput } = spec;

		// Deep merge: spec options override defaults
		const merged: OpenApiGeneratorOptions = {
			// Apply defaults first
			mode: defaults.mode,
			includeDescriptions: defaults.includeDescriptions,
			useDescribe: defaults.useDescribe,
			defaultNullable: defaults.defaultNullable,
			useOperationId: defaults.useOperationId,
			emptyObjectBehavior: defaults.emptyObjectBehavior,
			schemaType: defaults.schemaType,
			prefix: defaults.prefix,
			suffix: defaults.suffix,
			showStats: defaults.showStats,
			customDateTimeFormatRegex: defaults.customDateTimeFormatRegex,
			enumFormat: defaults.enumFormat,

			// Override with spec-specific values
			...specWithoutDeprecatedOutput,
			// resolvedOutputTypes is guaranteed to be defined by the validation checks above
			outputTypes: resolvedOutputTypes as string,
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
 * @returns Merged OpenApiGeneratorOptions with CLI taking precedence
 */
export function mergeCliWithConfig(
	specConfig: OpenApiGeneratorOptions,
	cliOptions: Partial<OpenApiGeneratorOptions>
): OpenApiGeneratorOptions {
	return coreMergeCliWithConfig(specConfig, cliOptions);
}
