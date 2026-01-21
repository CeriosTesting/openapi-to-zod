import {
	OperationFiltersSchema as BaseOperationFiltersSchema,
	createTypeScriptLoader,
	formatConfigValidationError,
	RequestResponseOptionsSchema,
} from "@cerios/openapi-to-zod/internal";
import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";
import type { OpenApiPlaywrightGeneratorOptions, PlaywrightConfigFile } from "../types";

/**
 * Zod schema for strict validation of Playwright config files
 * Extends base config schema but enforces schemaType: "all"
 */

// Extend base operation filters with Playwright-specific status code filtering
const OperationFiltersSchema = BaseOperationFiltersSchema.extend({
	includeStatusCodes: z.array(z.string()).optional(),
	excludeStatusCodes: z.array(z.string()).optional(),
});

const ZodErrorFormatSchema = z.enum(["standard", "prettify", "prettifyWithValues"]);

const OpenApiPlaywrightGeneratorOptionsSchema = z.strictObject({
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	input: z.string(),
	output: z.string(),
	outputClient: z.string(),
	outputService: z.string().optional(),
	includeDescriptions: z.boolean().optional(),
	validateServiceRequest: z.boolean().optional(),
	ignoreHeaders: z.array(z.string()).optional(),
	useDescribe: z.boolean().optional(),
	defaultNullable: z.boolean().optional(),
	emptyObjectBehavior: z.enum(["strict", "loose", "record"]).optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
	stripSchemaPrefix: z.string().optional(),
	showStats: z.boolean().optional(),
	request: RequestResponseOptionsSchema.optional(),
	response: RequestResponseOptionsSchema.optional(),
	name: z.string().optional(),
	basePath: z.string().optional(),
	stripPathPrefix: z.string().optional(),
	operationFilters: OperationFiltersSchema.optional(),
	cacheSize: z.number().positive().optional(),
	batchSize: z.number().positive().optional(),
	useOperationId: z.boolean().optional(),
	preferredContentTypes: z.array(z.string()).optional(),
	fallbackContentTypeParsing: z.enum(["text", "json", "body"]).optional(),
	zodErrorFormat: ZodErrorFormatSchema.optional(),
	customDateTimeFormatRegex: z
		.union([
			z.string().refine(
				pattern => {
					try {
						new RegExp(pattern);
						return true;
					} catch {
						return false;
					}
				},
				{ message: "Must be a valid regular expression pattern" }
			),
			z.instanceof(RegExp),
		])
		.optional(),
	// schemaType is not included - always "all" for Playwright
});

const PlaywrightConfigFileSchema = z.strictObject({
	defaults: z
		.strictObject({
			mode: z.enum(["strict", "normal", "loose"]).optional(),
			includeDescriptions: z.boolean().optional(),
			useDescribe: z.boolean().optional(),
			defaultNullable: z.boolean().optional(),
			emptyObjectBehavior: z.enum(["strict", "loose", "record"]).optional(),
			prefix: z.string().optional(),
			suffix: z.string().optional(),
			stripSchemaPrefix: z.string().optional(),
			showStats: z.boolean().optional(),
			request: RequestResponseOptionsSchema.optional(),
			response: RequestResponseOptionsSchema.optional(),
			generateService: z.boolean().optional(),
			validateServiceRequest: z.boolean().optional(),
			ignoreHeaders: z.array(z.string()).optional(),
			outputClient: z.string().optional(),
			outputService: z.string().optional(),
			basePath: z.string().optional(),
			stripPathPrefix: z.string().optional(),
			operationFilters: OperationFiltersSchema.optional(),
			cacheSize: z.number().positive().optional(),
			batchSize: z.number().positive().optional(),
			useOperationId: z.boolean().optional(),
			preferredContentTypes: z.array(z.string()).optional(),
			fallbackContentTypeParsing: z.enum(["text", "json", "body"]).optional(),
			zodErrorFormat: ZodErrorFormatSchema.optional(),
			customDateTimeFormatRegex: z
				.union([
					z.string().refine(
						pattern => {
							try {
								new RegExp(pattern);
								return true;
							} catch {
								return false;
							}
						},
						{ message: "Must be a valid regular expression pattern" }
					),
					z.instanceof(RegExp),
				])
				.optional(),
		})
		.optional(),
	specs: z
		.array(OpenApiPlaywrightGeneratorOptionsSchema)
		.min(1, {
			message:
				"Configuration must include at least one specification. Each specification should have 'input' and 'output' paths.",
		})
		.refine(specs => specs.every(spec => spec.input && spec.output && spec.outputClient), {
			message: "Each specification must have 'input', 'output', and 'outputClient' paths defined",
		}),
	executionMode: z.enum(["parallel", "sequential"]).optional(),
});

/**
 * Load and validate Playwright configuration file
 * Supports: openapi-to-zod-playwright.config.{ts,json}, package.json under "openapi-to-zod-playwright" key
 *
 * @param configPath - Optional explicit path to config file. If not provided, searches automatically
 * @returns Validated PlaywrightConfigFile object with schemaType enforced to "all"
 * @throws Error if config file not found, invalid, or contains unknown properties
 */
export async function loadConfig(configPath?: string): Promise<PlaywrightConfigFile> {
	const explorer = cosmiconfig("openapi-to-zod-playwright", {
		searchPlaces: ["openapi-to-zod-playwright.config.ts", "openapi-to-zod-playwright.config.json", "package.json"],
		loaders: {
			".ts": createTypeScriptLoader(),
		},
	});

	let result: Awaited<ReturnType<typeof explorer.load>> | Awaited<ReturnType<typeof explorer.search>>;

	if (configPath) {
		// Load from explicit path (overrides auto-discovery)
		result = await explorer.load(configPath);
	} else {
		// Auto-discover config file starting from cwd
		result = await explorer.search();
	}

	if (!result || !result.config) {
		throw new Error(
			configPath
				? `Config file not found at: ${configPath}`
				: "No config file found. Searched for: openapi-to-zod-playwright.config.ts, openapi-to-zod-playwright.config.json, package.json (openapi-to-zod-playwright key)\nRun 'openapi-to-zod-playwright init' to create a new config file."
		);
	}

	// Strict validation using Zod schema
	try {
		const validatedConfig = PlaywrightConfigFileSchema.parse(result.config);
		return validatedConfig;
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorMessage = formatConfigValidationError(error, result.filepath, configPath, [
				"Note: schemaType is always 'all' for Playwright generator (both request/response schemas)",
			]);
			throw new Error(errorMessage);
		}
		throw error;
	}
} /**
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

	return config.specs.map(spec => {
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
			// outputClient and outputService are intentionally NOT inherited from defaults
			// Each spec should define its own file paths

			// Override with spec-specific values (including required input)
			...spec,
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
	return {
		...specConfig,
		...Object.fromEntries(Object.entries(cliOptions).filter(([_, v]) => v !== undefined)),
		schemaType: "all", // Always enforce for Playwright
	} as OpenApiPlaywrightGeneratorOptions;
}
