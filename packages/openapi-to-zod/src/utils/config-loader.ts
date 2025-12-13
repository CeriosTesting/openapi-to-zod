import { cosmiconfig, type Loader } from "cosmiconfig";
import { z } from "zod";
import type { ConfigFile, OpenApiGeneratorOptions } from "../types";

/**
 * Zod schema for strict validation of config files
 * Rejects unknown properties to catch typos and invalid options
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

const OpenApiGeneratorOptionsSchema = z.strictObject({
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	input: z.string(),
	output: z.string(),
	includeDescriptions: z.boolean().optional(),
	enumType: z.enum(["zod", "typescript"]).optional(),
	useDescribe: z.boolean().optional(),
	schemaType: z.enum(["all", "request", "response"]).optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
	showStats: z.boolean().optional(),
	nativeEnumType: NativeEnumTypeSchema.optional(),
	request: RequestResponseOptionsSchema.optional(),
	response: RequestResponseOptionsSchema.optional(),
	name: z.string().optional(),
});

const ConfigFileSchema = z.strictObject({
	defaults: z
		.strictObject({
			mode: z.enum(["strict", "normal", "loose"]).optional(),
			includeDescriptions: z.boolean().optional(),
			enumType: z.enum(["zod", "typescript"]).optional(),
			useDescribe: z.boolean().optional(),
			schemaType: z.enum(["all", "request", "response"]).optional(),
			prefix: z.string().optional(),
			suffix: z.string().optional(),
			showStats: z.boolean().optional(),
			nativeEnumType: NativeEnumTypeSchema.optional(),
			request: RequestResponseOptionsSchema.optional(),
			response: RequestResponseOptionsSchema.optional(),
		})
		.optional(),
	specs: z.array(OpenApiGeneratorOptionsSchema).min(1, "At least one spec is required"),
	executionMode: z.enum(["parallel", "sequential"]).optional(),
});

/**
 * TypeScript loader using tsx for executing .ts config files
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
				: "No config file found. Searched for: openapi-to-zod.config.ts, openapi-to-zod.config.json, package.json (openapi-to-zod key)"
		);
	}

	// Strict validation using Zod schema
	try {
		const validatedConfig = ConfigFileSchema.parse(result.config);
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
				`Invalid configuration file at: ${configSource}`,
				"",
				"Validation errors:",
				formattedErrors,
				"",
				"Please check your configuration file and ensure:",
				"  - All required fields are present (specs array with input/output)",
				"  - Field names are spelled correctly (no typos)",
				"  - Values match the expected types (e.g., mode: 'strict' | 'normal' | 'loose')",
				"  - No unknown/extra properties are included",
			].join("\n");

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
			enumType: defaults.enumType,
			useDescribe: defaults.useDescribe,
			schemaType: defaults.schemaType,
			prefix: defaults.prefix,
			suffix: defaults.suffix,
			showStats: defaults.showStats,

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
