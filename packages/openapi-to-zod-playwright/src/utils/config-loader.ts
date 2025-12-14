import { cosmiconfig, type Loader } from "cosmiconfig";
import { z } from "zod";
import type { OpenApiPlaywrightOpenApiGeneratorOptions, PlaywrightConfigFile } from "../types";

/**
 * Zod schema for strict validation of Playwright config files
 * Extends base config schema but enforces schemaType: "all"
 */
const TypeModeSchema = z.enum(["inferred", "native"]);
const NativeEnumTypeSchema = z.enum(["union", "enum"]);

const RequestResponseOptionsSchema = z.strictObject({
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	enumType: z.enum(["zod", "typescript"]).optional(),
	useDescribe: z.boolean().optional(),
	includeDescriptions: z.boolean().optional(),
	typeMode: TypeModeSchema.optional(),
	nativeEnumType: NativeEnumTypeSchema.optional(),
});

const OperationFiltersSchema = z.strictObject({
	includeTags: z.array(z.string()).optional(),
	excludeTags: z.array(z.string()).optional(),
	includePaths: z.array(z.string()).optional(),
	excludePaths: z.array(z.string()).optional(),
	includeMethods: z.array(z.string()).optional(),
	excludeMethods: z.array(z.string()).optional(),
	includeOperationIds: z.array(z.string()).optional(),
	excludeOperationIds: z.array(z.string()).optional(),
	excludeDeprecated: z.boolean().optional(),
	includeStatusCodes: z.array(z.string()).optional(),
	excludeStatusCodes: z.array(z.string()).optional(),
});

const OpenApiPlaywrightOpenApiGeneratorOptionsSchema = z.strictObject({
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	input: z.string(),
	output: z.string().optional(),
	outputClient: z.string().optional(),
	outputService: z.string().optional(),
	validateServiceRequest: z.boolean().optional(),
	enumType: z.enum(["zod", "typescript"]).optional(),
	useDescribe: z.boolean().optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
	showStats: z.boolean().optional(),
	nativeEnumType: NativeEnumTypeSchema.optional(),
	request: RequestResponseOptionsSchema.optional(),
	response: RequestResponseOptionsSchema.optional(),
	name: z.string().optional(),
	basePath: z.string().optional(),
	operationFilters: OperationFiltersSchema.optional(),
	// schemaType is not included - always "all" for Playwright
});

const PlaywrightConfigFileSchema = z.strictObject({
	defaults: z
		.strictObject({
			mode: z.enum(["strict", "normal", "loose"]).optional(),
			includeDescriptions: z.boolean().optional(),
			enumType: z.enum(["zod", "typescript"]).optional(),
			useDescribe: z.boolean().optional(),
			prefix: z.string().optional(),
			suffix: z.string().optional(),
			showStats: z.boolean().optional(),
			nativeEnumType: NativeEnumTypeSchema.optional(),
			request: RequestResponseOptionsSchema.optional(),
			response: RequestResponseOptionsSchema.optional(),
			generateService: z.boolean().optional(),
			validateServiceRequest: z.boolean().optional(),
			outputClient: z.string().optional(),
			outputService: z.string().optional(),
			basePath: z.string().optional(),
			operationFilters: OperationFiltersSchema.optional(),
		})
		.optional(),
	specs: z.array(OpenApiPlaywrightOpenApiGeneratorOptionsSchema).min(1, "At least one spec is required"),
	executionMode: z.enum(["parallel", "sequential"]).optional(),
});

/**
 * TypeScript loader using esbuild for executing .ts config files
 * Uses Node's module._compile to execute TypeScript after transpiling with esbuild
 */
const createTypeScriptLoader = (): Loader => {
	return async (filepath: string) => {
		try {
			// Use esbuild to transpile TypeScript to JavaScript
			const esbuild = await import("esbuild");
			const fs = await import("node:fs");
			const path = await import("node:path");

			const tsCode = fs.readFileSync(filepath, "utf-8");
			const result = await esbuild.build({
				stdin: {
					contents: tsCode,
					loader: "ts",
					resolveDir: path.dirname(filepath),
					sourcefile: filepath,
				},
				format: "cjs",
				platform: "node",
				target: "node18",
				bundle: false,
				write: false,
			});

			const jsCode = result.outputFiles[0].text;

			// Create a module and execute it
			const module = { exports: {} } as any;
			const func = new Function("exports", "module", "require", "__filename", "__dirname", jsCode);
			func(module.exports, module, require, filepath, path.dirname(filepath));

			return module.exports.default || module.exports;
		} catch (error) {
			throw new Error(
				`Failed to load TypeScript config from ${filepath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	};
};

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
				: "No config file found. Searched for: openapi-to-zod-playwright.config.ts, openapi-to-zod-playwright.config.json, package.json (openapi-to-zod-playwright key)"
		);
	}

	// Strict validation using Zod schema
	try {
		const validatedConfig = PlaywrightConfigFileSchema.parse(result.config);
		return validatedConfig;
	} catch (error) {
		if (error instanceof z.ZodError) {
			const formattedErrors =
				error.issues
					?.map(err => {
						const path = err.path.length > 0 ? err.path.join(".") : "root";
						return `  - ${path}: ${err.message}`;
					})
					.join("\n") || "Unknown validation error";

			const configSource = result.filepath || configPath || "config file";
			const errorMessage = [
				`Invalid Playwright configuration file at: ${configSource}`,
				"",
				"Validation errors:",
				formattedErrors,
				"",
				"Please check your configuration file and ensure:",
				"  - All required fields are present (specs array with input)",
				"  - Field names are spelled correctly (no typos)",
				"  - Values match the expected types (e.g., mode: 'strict' | 'normal' | 'loose')",
				"  - No unknown/extra properties are included",
				"  - Note: schemaType is always 'all' for Playwright generator (both request/response schemas)",
			].join("\n");

			throw new Error(errorMessage);
		}
		throw error;
	}
}

/**
 * Merge global defaults with per-spec configuration
 * CLI arguments have highest precedence and are merged separately in CLI layer
 * Automatically enforces schemaType: "all" for all specs
 *
 * @param config - Validated Playwright configuration file
 * @returns Array of fully resolved OpenApiPlaywrightOpenApiGeneratorOptions objects with schemaType enforced to "all"
 */
export function mergeConfigWithDefaults(config: PlaywrightConfigFile): OpenApiPlaywrightOpenApiGeneratorOptions[] {
	if (!config?.specs || !Array.isArray(config.specs)) {
		throw new Error("Invalid config: specs array is required");
	}

	const defaults = config.defaults || {};

	return config.specs.map(spec => {
		// Deep merge: spec options override defaults
		const merged: OpenApiPlaywrightOpenApiGeneratorOptions = {
			// Apply defaults first
			mode: defaults.mode,
			includeDescriptions: defaults.includeDescriptions,
			enumType: defaults.enumType,
			useDescribe: defaults.useDescribe,
			prefix: defaults.prefix,
			suffix: defaults.suffix,
			showStats: defaults.showStats,
			validateServiceRequest: defaults.validateServiceRequest,
			outputClient: defaults.outputClient,
			outputService: defaults.outputService,
			nativeEnumType: defaults.nativeEnumType,

			// Override with spec-specific values (including required input)
			...spec, // Always enforce schemaType: "all" for Playwright
			schemaType: "all",
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
 * @returns Merged OpenApiPlaywrightOpenApiGeneratorOptions with CLI taking precedence and schemaType enforced
 */
export function mergeCliWithConfig(
	specConfig: OpenApiPlaywrightOpenApiGeneratorOptions,
	cliOptions: Partial<OpenApiPlaywrightOpenApiGeneratorOptions>
): OpenApiPlaywrightOpenApiGeneratorOptions {
	// CLI options override everything, but schemaType is always "all"
	return {
		...specConfig,
		...Object.fromEntries(Object.entries(cliOptions).filter(([_, v]) => v !== undefined)),
		schemaType: "all", // Always enforce for Playwright
	} as OpenApiPlaywrightOpenApiGeneratorOptions;
}
