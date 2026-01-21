import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";
import type { ConfigFile, OpenApiGeneratorOptions } from "../types";
import { OperationFiltersSchema, RequestResponseOptionsSchema } from "./config-schemas";
import { formatConfigValidationError } from "./config-validation";
import { createTypeScriptLoader } from "./typescript-loader";

const OpenApiGeneratorOptionsSchema = z.strictObject({
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	input: z.string(),
	output: z.string(),
	includeDescriptions: z.boolean().optional(),
	useDescribe: z.boolean().optional(),
	defaultNullable: z.boolean().optional(),
	emptyObjectBehavior: z.enum(["strict", "loose", "record"]).optional(),
	schemaType: z.enum(["all", "request", "response"]).optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
	stripSchemaPrefix: z.string().optional(),
	showStats: z.boolean().optional(),
	request: RequestResponseOptionsSchema.optional(),
	response: RequestResponseOptionsSchema.optional(),
	name: z.string().optional(),
	operationFilters: OperationFiltersSchema.optional(),
	cacheSize: z.number().positive().optional(),
	batchSize: z.number().positive().optional(),
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
});

const ConfigFileSchema = z.strictObject({
	defaults: z
		.strictObject({
			mode: z.enum(["strict", "normal", "loose"]).optional(),
			includeDescriptions: z.boolean().optional(),
			useDescribe: z.boolean().optional(),
			defaultNullable: z.boolean().optional(),
			emptyObjectBehavior: z.enum(["strict", "loose", "record"]).optional(),
			schemaType: z.enum(["all", "request", "response"]).optional(),
			prefix: z.string().optional(),
			suffix: z.string().optional(),
			stripSchemaPrefix: z.string().optional(),
			showStats: z.boolean().optional(),
			request: RequestResponseOptionsSchema.optional(),
			response: RequestResponseOptionsSchema.optional(),
			operationFilters: OperationFiltersSchema.optional(),
			cacheSize: z.number().positive().optional(),
			batchSize: z.number().positive().optional(),
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
		.array(OpenApiGeneratorOptionsSchema)
		.min(1, {
			message:
				"Configuration must include at least one specification. Each specification should have 'input' and 'output' paths.",
		})
		.refine(specs => specs.every(spec => spec.input && spec.output), {
			message: "Each specification must have both 'input' and 'output' paths defined",
		}),
	executionMode: z.enum(["parallel", "sequential"]).optional(),
});

/**
 * Load and validate configuration file
 * Supports: openapi-to-zod.config.{ts,json}, package.json under "openapi-to-zod" key
 *
 * @param configPath - Optional explicit path to config file. If not provided, searches automatically
 * @returns Validated ConfigFile object
 * @throws Error if config file not found, invalid, or contains unknown properties
 */
export async function loadConfig(configPath?: string): Promise<ConfigFile> {
	const explorer = cosmiconfig("openapi-to-zod", {
		searchPlaces: ["openapi-to-zod.config.ts", "openapi-to-zod.config.json", "package.json"],
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
				: "No config file found. Searched for: openapi-to-zod.config.ts, openapi-to-zod.config.json, package.json (openapi-to-zod key)\nRun 'openapi-to-zod init' to create a new config file."
		);
	}

	// Strict validation using Zod schema
	try {
		const validatedConfig = ConfigFileSchema.parse(result.config);
		return validatedConfig;
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorMessage = formatConfigValidationError(error, result.filepath, configPath);
			throw new Error(errorMessage);
		}
		throw error;
	}
}

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

	return config.specs.map(spec => {
		// Deep merge: spec options override defaults
		const merged: OpenApiGeneratorOptions = {
			// Apply defaults first
			mode: defaults.mode,
			includeDescriptions: defaults.includeDescriptions,
			useDescribe: defaults.useDescribe,
			defaultNullable: defaults.defaultNullable,
			emptyObjectBehavior: defaults.emptyObjectBehavior,
			schemaType: defaults.schemaType,
			prefix: defaults.prefix,
			suffix: defaults.suffix,
			showStats: defaults.showStats,
			customDateTimeFormatRegex: defaults.customDateTimeFormatRegex,

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
 * @returns Merged OpenApiGeneratorOptions with CLI taking precedence
 */
export function mergeCliWithConfig(
	specConfig: OpenApiGeneratorOptions,
	cliOptions: Partial<OpenApiGeneratorOptions>
): OpenApiGeneratorOptions {
	// CLI options override everything
	return {
		...specConfig,
		...Object.fromEntries(Object.entries(cliOptions).filter(([_, v]) => v !== undefined)),
	} as OpenApiGeneratorOptions;
}
