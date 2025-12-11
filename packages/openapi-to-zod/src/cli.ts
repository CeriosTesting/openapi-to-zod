#!/usr/bin/env node
import { Command } from "commander";
import { z } from "zod";
import { executeBatch, getBatchExitCode } from "./batch-executor";
import { CliOptionsError } from "./errors";
import { ZodSchemaGenerator } from "./generator";
import type { ExecutionMode, GeneratorOptions } from "./types";
import { loadConfig, mergeCliWithConfig, mergeConfigWithDefaults } from "./utils/config-loader";

/**
 * Zod schema for CLI options validation
 */
const CliOptionsSchema = z.object({
	config: z.string().optional(),
	input: z.string().optional(),
	output: z.string().optional(),
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	descriptions: z.boolean().optional(),
	enumType: z.enum(["zod", "typescript"]).optional(),
	useDescribe: z.boolean().optional(),
	schemaType: z.enum(["all", "request", "response"]).optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
	stats: z.boolean().optional(),
	nativeEnumType: z.enum(["union", "enum"]).optional(),
	requestMode: z.enum(["strict", "normal", "loose"]).optional(),
	requestTypeMode: z.enum(["inferred", "native"]).optional(),
	requestEnumType: z.enum(["zod", "typescript"]).optional(),
	requestNativeEnumType: z.enum(["union", "enum"]).optional(),
	requestUseDescribe: z.boolean().optional(),
	requestDescriptions: z.boolean().optional(),
	responseMode: z.enum(["strict", "normal", "loose"]).optional(),
	responseEnumType: z.enum(["zod", "typescript"]).optional(),
	responseNativeEnumType: z.enum(["union", "enum"]).optional(),
	responseUseDescribe: z.boolean().optional(),
	responseDescriptions: z.boolean().optional(),
	executionMode: z.enum(["parallel", "sequential"]).optional(),
});

/**
 * Validate CLI options using Zod schema
 */
function validateCliOptions(options: unknown): asserts options is z.infer<typeof CliOptionsSchema> {
	try {
		CliOptionsSchema.parse(options);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const formattedErrors = error.issues.map(err => `  --${err.path.join(".")}: ${err.message}`).join("\n");
			throw new CliOptionsError(`Invalid CLI options:\n${formattedErrors}`, { zodError: error });
		}
		throw error;
	}
}

const program = new Command();

program
	.name("openapi-to-zod")
	.description("Generate Zod v4 schemas from OpenAPI specifications")
	.version("1.0.0")
	.option("-c, --config <path>", "Path to config file (openapi-to-zod.config.{ts,json})")
	.option("-i, --input <path>", "Input OpenAPI YAML file path (single-spec mode)")
	.option("-o, --output <path>", "Output TypeScript file path (single-spec mode)")
	.option("-m, --mode <mode>", "Validation mode: strict, normal, or loose", "normal")
	.option("--no-descriptions", "Exclude JSDoc descriptions from generated schemas")
	.option("-e, --enum-type <type>", "Enum type: zod or typescript", "zod")
	.option("--use-describe", "Add .describe() calls for better runtime error messages")
	.option("-s, --schema-type <type>", "Schema type: all, request, or response", "all")
	.option("-p, --prefix <prefix>", "Add prefix to all generated schema names")
	.option("--suffix <suffix>", "Add suffix before 'Schema' in generated names")
	.option("--no-stats", "Exclude generation statistics from output file")
	.option("--native-enum-type <type>", "Native enum type: union or enum", "union")
	.option("--request-mode <mode>", "Request validation mode: strict, normal, or loose")
	.option("--request-type-mode <mode>", "Request type generation: inferred or native")
	.option("--request-enum-type <type>", "Request enum type: zod or typescript")
	.option("--request-native-enum-type <type>", "Request native enum type: union or enum")
	.option("--request-use-describe", "Add .describe() calls for request schemas")
	.option("--request-descriptions", "Include descriptions for request schemas")
	.option("--no-request-descriptions", "Exclude descriptions for request schemas")
	.option("--response-mode <mode>", "Response validation mode: strict, normal, or loose")
	.option("--response-enum-type <type>", "Response enum type: zod or typescript")
	.option("--response-native-enum-type <type>", "Response native enum type: union or enum")
	.option("--response-use-describe", "Add .describe() calls for response schemas")
	.option("--response-descriptions", "Include descriptions for response schemas")
	.option("--no-response-descriptions", "Exclude descriptions for response schemas")
	.option("--execution-mode <mode>", "Batch execution mode: parallel (default) or sequential")
	.addHelpText(
		"after",
		`
Examples:
  # Generate Zod schemas (default - always generates response schemas)
  $ openapi-to-zod -i openapi.yaml -o schemas.ts

  # Generate native TypeScript types for requests, Zod schemas for responses
  $ openapi-to-zod -i openapi.yaml -o types.ts --request-type-mode native

  # Generate with config file
  $ openapi-to-zod -c openapi-to-zod.config.ts
`
	)
	.action(async options => {
		try {
			// Validate CLI options
			validateCliOptions(options);

			// Check if config file mode or single-spec mode
			if (options.config || (!options.input && !options.output)) {
				// Config file mode (batch processing)
				await executeBatchMode(options);
			} else {
				// Single-spec mode (original behavior)
				await executeSingleSpecMode(options);
			}
		} catch (error) {
			if (error instanceof CliOptionsError) {
				console.error(error.message);
				process.exit(1);
			}
			console.error("Error:", error instanceof Error ? error.message : String(error));
			if (error instanceof Error && error.stack) {
				console.error("\nStack trace:", error.stack);
			}
			process.exit(1);
		}
	});

program.parse();

/**
 * Execute single-spec mode (original CLI behavior)
 */
async function executeSingleSpecMode(options: z.infer<typeof CliOptionsSchema>): Promise<void> {
	if (!options.input || !options.output) {
		throw new CliOptionsError("Both --input and --output are required in single-spec mode", {
			input: options.input,
			output: options.output,
		});
	}

	const generatorOptions: GeneratorOptions = {
		input: options.input,
		output: options.output,
		mode: options.mode,
		includeDescriptions: options.descriptions,
		enumType: options.enumType,
		useDescribe: options.useDescribe || false,
		schemaType: options.schemaType || "all",
		prefix: options.prefix,
		suffix: options.suffix,
		showStats: options.stats ?? true,
		nativeEnumType: options.nativeEnumType,
	};

	// Build request options if any request-specific flags are set
	if (
		options.requestMode ||
		options.requestTypeMode ||
		options.requestEnumType ||
		options.requestNativeEnumType ||
		options.requestUseDescribe ||
		options.requestDescriptions !== undefined
	) {
		generatorOptions.request = {
			mode: options.requestMode,
			typeMode: options.requestTypeMode,
			enumType: options.requestEnumType,
			nativeEnumType: options.requestNativeEnumType,
			useDescribe: options.requestUseDescribe || undefined,
			includeDescriptions: options.requestDescriptions,
		};
	}

	// Build response options if any response-specific flags are set
	if (
		options.responseMode ||
		options.responseEnumType ||
		options.responseNativeEnumType ||
		options.responseUseDescribe ||
		options.responseDescriptions !== undefined
	) {
		generatorOptions.response = {
			mode: options.responseMode,
			enumType: options.responseEnumType,
			nativeEnumType: options.responseNativeEnumType,
			useDescribe: options.responseUseDescribe || undefined,
			includeDescriptions: options.responseDescriptions,
		};
	}

	const generator = new ZodSchemaGenerator(generatorOptions);
	generator.generate();
	console.log(`✓ Successfully generated schemas at ${options.output}`);
}

/**
 * Execute batch mode from config file
 */
async function executeBatchMode(options: z.infer<typeof CliOptionsSchema>): Promise<void> {
	// Load config file
	const config = await loadConfig(options.config);

	// Merge defaults with specs
	let specs = mergeConfigWithDefaults(config);

	// Extract CLI options that can override config
	const cliOverrides: Partial<GeneratorOptions> = {};
	if (options.mode && options.mode !== "normal") cliOverrides.mode = options.mode;
	if (options.descriptions !== undefined) cliOverrides.includeDescriptions = options.descriptions;
	if (options.enumType && options.enumType !== "zod") cliOverrides.enumType = options.enumType;
	if (options.useDescribe) cliOverrides.useDescribe = true;
	if (options.schemaType && options.schemaType !== "all") cliOverrides.schemaType = options.schemaType;
	if (options.prefix) cliOverrides.prefix = options.prefix;
	if (options.suffix) cliOverrides.suffix = options.suffix;
	if (options.stats !== undefined) cliOverrides.showStats = options.stats;
	if (options.nativeEnumType) cliOverrides.nativeEnumType = options.nativeEnumType;

	// Build request/response overrides from CLI
	if (
		options.requestMode ||
		options.requestTypeMode ||
		options.requestEnumType ||
		options.requestNativeEnumType ||
		options.requestUseDescribe ||
		options.requestDescriptions !== undefined
	) {
		cliOverrides.request = {
			mode: options.requestMode,
			typeMode: options.requestTypeMode,
			enumType: options.requestEnumType,
			nativeEnumType: options.requestNativeEnumType,
			useDescribe: options.requestUseDescribe,
			includeDescriptions: options.requestDescriptions,
		};
	}

	if (
		options.responseMode ||
		options.responseEnumType ||
		options.responseNativeEnumType ||
		options.responseUseDescribe ||
		options.responseDescriptions !== undefined
	) {
		cliOverrides.response = {
			mode: options.responseMode,
			enumType: options.responseEnumType,
			nativeEnumType: options.responseNativeEnumType,
			useDescribe: options.responseUseDescribe,
			includeDescriptions: options.responseDescriptions,
		};
	}

	// Apply CLI overrides to all specs if any CLI options were provided
	if (Object.keys(cliOverrides).length > 0) {
		specs = specs.map(spec => mergeCliWithConfig(spec, cliOverrides));
	}

	// Determine execution mode
	const executionMode: ExecutionMode = (options.executionMode as ExecutionMode) || config.executionMode || "parallel";

	// Execute batch
	const summary = await executeBatch(specs, executionMode);

	// Exit with appropriate code
	const exitCode = getBatchExitCode(summary);
	if (exitCode !== 0) {
		process.exit(exitCode);
	}
}
