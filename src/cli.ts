#!/usr/bin/env node
/** biome-ignore-all lint/suspicious/noConsole: Logging for the CLI tool */
import { Command } from "commander";
import { executeBatch, getBatchExitCode } from "./batch-executor";
import { ZodSchemaGenerator } from "./generator";
import type { ExecutionMode, GeneratorOptions } from "./types";
import { loadConfig, mergeCliWithConfig, mergeConfigWithDefaults } from "./utils/config-loader";

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
	.option("--type-mode <mode>", "Type generation: inferred (Zod + z.infer) or native (TypeScript types)", "inferred")
	.option("--native-enum-type <type>", "Native enum type: union or enum", "union")
	.option("--request-mode <mode>", "Request validation mode: strict, normal, or loose")
	.option("--request-type-mode <mode>", "Request type generation: inferred or native")
	.option("--request-enum-type <type>", "Request enum type: zod or typescript")
	.option("--request-native-enum-type <type>", "Request native enum type: union or enum")
	.option("--request-use-describe", "Add .describe() calls for request schemas")
	.option("--request-descriptions", "Include descriptions for request schemas")
	.option("--no-request-descriptions", "Exclude descriptions for request schemas")
	.option("--response-mode <mode>", "Response validation mode: strict, normal, or loose")
	.option("--response-type-mode <mode>", "Response type generation: inferred or native")
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
  # Generate Zod schemas with inferred types (default)
  $ openapi-to-zod -i openapi.yaml -o schemas.ts

  # Generate native TypeScript types
  $ openapi-to-zod -i openapi.yaml -o types.ts --type-mode native

  # Mixed mode: native types for requests, Zod schemas for responses
  $ openapi-to-zod -i openapi.yaml -o types.ts --request-type-mode native --response-type-mode inferred

  # Generate with config file
  $ openapi-to-zod -c openapi-to-zod.config.ts
`
	)
	.action(async options => {
		try {
			// Check if config file mode or single-spec mode
			if (options.config || (!options.input && !options.output)) {
				// Config file mode (batch processing)
				await executeBatchMode(options);
			} else {
				// Single-spec mode (original behavior)
				await executeSingleSpecMode(options);
			}
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program.parse();

/**
 * Execute single-spec mode (original CLI behavior)
 */
async function executeSingleSpecMode(options: any): Promise<void> {
	if (!options.input || !options.output) {
		throw new Error("Both --input and --output are required in single-spec mode");
	}

	const generatorOptions: GeneratorOptions = {
		input: options.input,
		output: options.output,
		mode: options.mode as "strict" | "normal" | "loose",
		includeDescriptions: options.descriptions,
		enumType: options.enumType as "zod" | "typescript",
		useDescribe: options.useDescribe || false,
		schemaType: (options.schemaType as "all" | "request" | "response") || "all",
		prefix: options.prefix,
		suffix: options.suffix,
		showStats: options.stats ?? true,
		typeMode: options.typeMode as "inferred" | "native" | undefined,
		nativeEnumType: options.nativeEnumType as "union" | "enum" | undefined,
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
			mode: options.requestMode as "strict" | "normal" | "loose" | undefined,
			typeMode: options.requestTypeMode as "inferred" | "native" | undefined,
			enumType: options.requestEnumType as "zod" | "typescript" | undefined,
			nativeEnumType: options.requestNativeEnumType as "union" | "enum" | undefined,
			useDescribe: options.requestUseDescribe || undefined,
			includeDescriptions: options.requestDescriptions,
		};
	}

	// Build response options if any response-specific flags are set
	if (
		options.responseMode ||
		options.responseTypeMode ||
		options.responseEnumType ||
		options.responseNativeEnumType ||
		options.responseUseDescribe ||
		options.responseDescriptions !== undefined
	) {
		generatorOptions.response = {
			mode: options.responseMode as "strict" | "normal" | "loose" | undefined,
			typeMode: options.responseTypeMode as "inferred" | "native" | undefined,
			enumType: options.responseEnumType as "zod" | "typescript" | undefined,
			nativeEnumType: options.responseNativeEnumType as "union" | "enum" | undefined,
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
async function executeBatchMode(options: any): Promise<void> {
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
	if (options.typeMode) cliOverrides.typeMode = options.typeMode;
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
		options.responseTypeMode ||
		options.responseEnumType ||
		options.responseNativeEnumType ||
		options.responseUseDescribe ||
		options.responseDescriptions !== undefined
	) {
		cliOverrides.response = {
			mode: options.responseMode,
			typeMode: options.responseTypeMode,
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
