import {
	BaseDefaultsSchema,
	BaseGeneratorOptionsSchema,
	mergeCliWithConfig as coreMergeCliWithConfig,
	createConfigLoader,
	ExecutionModeSchema,
	type FormatZodErrorsOptions,
	OperationFiltersSchema,
	RegexPatternSchema,
	RequestResponseOptionsSchema,
} from "@cerios/openapi-core";
import { z } from "zod";

import type { OpenApiPlaywrightGeneratorOptions, PlaywrightConfigFile } from "../types";

/**
 * Playwright operation filters schema - extends base with status code filtering
 */
const PlaywrightOperationFiltersSchema = OperationFiltersSchema.extend({
	includeStatusCodes: z.array(z.string()).optional(),
	excludeStatusCodes: z.array(z.string()).optional(),
});

/**
 * Zod error format schema for Playwright-specific formatting
 */
const ZodErrorFormatSchema = z.enum(["standard", "prettify", "prettifyWithValues"]);

/**
 * Playwright-specific options schema (beyond base options)
 * Note: schemaType is not included - always "all" for Playwright
 */
const PlaywrightSpecificOptionsSchema = z.strictObject({
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	outputClient: z.string(),
	outputService: z.string().optional(),
	validateServiceRequest: z.boolean().optional(),
	ignoreHeaders: z.array(z.string()).optional(),
	useDescribe: z.boolean().optional(),
	emptyObjectBehavior: z.enum(["strict", "loose", "record"]).optional(),
	request: RequestResponseOptionsSchema.optional(),
	response: RequestResponseOptionsSchema.optional(),
	basePath: z.string().optional(),
	operationFilters: PlaywrightOperationFiltersSchema.optional(),
	useOperationId: z.boolean().optional(),
	fallbackContentTypeParsing: z.enum(["text", "json", "body"]).optional(),
	zodErrorFormat: ZodErrorFormatSchema.optional(),
	customDateTimeFormatRegex: z.union([RegexPatternSchema, z.instanceof(RegExp)]).optional(),
	outputZodSchemas: z.string().optional(),
	enumFormat: z.enum(["union", "const-object"]).optional(),
	typeAssertionThreshold: z.number().int().gte(0).optional(),
});

/**
 * Full Playwright generator options schema - base + Playwright-specific
 * Uses .extend() instead of deprecated .merge() for Zod v4 compatibility
 */
const OpenApiPlaywrightGeneratorOptionsSchema = BaseGeneratorOptionsSchema.omit({
	operationFilters: true, // Use Playwright-specific version
})
	.extend({
		...PlaywrightSpecificOptionsSchema.shape,
		outputTypes: z.string().optional(),
		output: z.string().optional(),
	})
	.superRefine((spec, ctx) => {
		const hasOutputTypes = Boolean(spec.outputTypes);
		const hasOutput = Boolean(spec.output);
		const hasOutputZodSchemas = Boolean(spec.outputZodSchemas);

		// When outputZodSchemas is specified, outputTypes is required for TypeScript types
		if (hasOutputZodSchemas && !hasOutputTypes && !hasOutput) {
			ctx.addIssue({
				code: "custom",
				path: ["outputTypes"],
				message: "When 'outputZodSchemas' is specified, 'outputTypes' is required for TypeScript type definitions.",
			});
		}

		// Standard validation when outputZodSchemas is not used
		if (!hasOutputZodSchemas && !hasOutputTypes && !hasOutput) {
			ctx.addIssue({
				code: "custom",
				path: ["outputTypes"],
				message: "Each spec must specify an output file path using 'outputTypes' (preferred) or deprecated 'output'.",
			});
		}

		if (hasOutputTypes && hasOutput && spec.outputTypes !== spec.output) {
			ctx.addIssue({
				code: "custom",
				path: ["output"],
				message: "Invalid configuration: 'outputTypes' and deprecated 'output' are both set but have different values.",
			});
		}
	});

/**
 * Playwright defaults schema - base defaults + Playwright-specific options
 * Adds generateService which is a defaults-only option
 * Uses .extend() instead of deprecated .merge() for Zod v4 compatibility
 */
const PlaywrightDefaultsSchema = BaseDefaultsSchema.omit({ operationFilters: true }).extend({
	...PlaywrightSpecificOptionsSchema.omit({ outputClient: true }).shape,
	generateService: z.boolean().optional(),
	outputClient: z.string().optional(), // Optional in defaults
});

/**
 * Playwright config file schema
 */
const PlaywrightConfigFileSchema = z.strictObject({
	defaults: PlaywrightDefaultsSchema.optional(),
	specs: z.array(OpenApiPlaywrightGeneratorOptionsSchema).min(1, {
		message:
			"Configuration must include at least one specification. Each specification should have 'input', 'outputTypes', and 'outputClient' paths.",
	}),
	executionMode: ExecutionModeSchema.optional(),
});

// Custom error messages for user-friendly validation errors
const errorMessages: FormatZodErrorsOptions = {
	missingFieldMessages: {
		input: "Each spec must specify the path to your OpenAPI specification file.",
		outputTypes: "Each spec must specify an output file path for generated Zod schemas.",
		outputClient: "Each spec must specify an output file path for the generated Playwright API client.",
	},
	unrecognizedKeyMessages: {},
	requiredFieldsHelp: "All required fields are present (specs array with input/outputTypes/outputClient)",
};

// Create config loader using factory from core
const configLoader = createConfigLoader<PlaywrightConfigFile>(
	{
		packageName: "openapi-to-zod-playwright",
		errorMessages,
	},
	PlaywrightConfigFileSchema
);

/**
 * Load and validate Playwright configuration file
 * Supports: openapi-to-zod-playwright.config.{ts,json}, package.json under "openapi-to-zod-playwright" key
 *
 * @param configPath - Optional explicit path to config file. If not provided, searches automatically
 * @returns Validated PlaywrightConfigFile object with schemaType enforced to "all"
 * @throws Error if config file not found, invalid, or contains unknown properties
 */
export const loadConfig = configLoader.loadConfig;

/**
 * Merge global defaults with per-spec configuration
 * CLI arguments have highest precedence and are merged separately in CLI layer
 * Automatically enforces schemaType: "all" for all specs
 *
 * @param config - Validated Playwright configuration file
 * @returns Array of fully resolved OpenApiPlaywrightGeneratorOptions objects with schemaType enforced to "all"
 */
export function mergeConfigWithDefaults(config: PlaywrightConfigFile): OpenApiPlaywrightGeneratorOptions[] {
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
				"[openapi-to-zod-playwright] Deprecation warning: 'output' is deprecated and will be removed in a future release. Use 'outputTypes' instead."
			);
			warnedDeprecatedOutput = true;
		}

		const { output: _deprecatedOutput, ...specWithoutDeprecatedOutput } = spec;

		// Deep merge: spec options override defaults
		const merged: OpenApiPlaywrightGeneratorOptions = {
			// Apply defaults first
			mode: defaults.mode,
			includeDescriptions: defaults.includeDescriptions,
			useDescribe: defaults.useDescribe,
			defaultNullable: defaults.defaultNullable,
			emptyObjectBehavior: defaults.emptyObjectBehavior,
			prefix: defaults.prefix,
			suffix: defaults.suffix,
			showStats: defaults.showStats,
			validateServiceRequest: defaults.validateServiceRequest,
			ignoreHeaders: defaults.ignoreHeaders,
			customDateTimeFormatRegex: defaults.customDateTimeFormatRegex,
			preferredContentTypes: defaults.preferredContentTypes,
			fallbackContentTypeParsing: defaults.fallbackContentTypeParsing,
			zodErrorFormat: defaults.zodErrorFormat,
			enumFormat: defaults.enumFormat,
			// outputClient and outputService are intentionally NOT inherited from defaults
			// Each spec should define its own file paths

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
 * schemaType is always "all" for Playwright (cannot be overridden)
 *
 * @param specConfig - Configuration from config file (with defaults already applied)
 * @param cliOptions - Options provided via CLI arguments
 * @returns Merged OpenApiPlaywrightGeneratorOptions with CLI taking precedence and schemaType enforced
 */
export function mergeCliWithConfig(
	specConfig: OpenApiPlaywrightGeneratorOptions,
	cliOptions: Partial<OpenApiPlaywrightGeneratorOptions>
): OpenApiPlaywrightGeneratorOptions {
	// CLI options override everything, but schemaType is always "all"
	const merged = coreMergeCliWithConfig(specConfig, cliOptions);
	return {
		...merged,
		schemaType: "all", // Always enforce for Playwright
	} as OpenApiPlaywrightGeneratorOptions;
}
