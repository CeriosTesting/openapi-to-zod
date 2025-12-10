#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { z } from "zod";
import { CliOptionsError } from "./errors";
import { PlaywrightGenerator } from "./playwright-generator";
import { type PlaywrightGeneratorOptions } from "./types";

/**
 * Zod schema for CLI options validation
 * Ensures all options are valid before passing to generator
 */
const CliOptionsSchema = z.object({
	input: z.string().min(1, "Input path cannot be empty"),
	output: z.string().min(1, "Output path cannot be empty"),
	outputClient: z.string().optional(),
	outputService: z.string().optional(),
	generateService: z.boolean().default(true),
	validateServiceRequest: z.boolean().default(false),
	mode: z.enum(["strict", "normal", "loose"]).default("normal"),
	typeMode: z.enum(["inferred", "native"]).default("inferred"),
	enumType: z.enum(["zod", "typescript"]).default("zod"),
	nativeEnumType: z.enum(["union", "enum"]).default("union"),
	descriptions: z.boolean().default(true),
	useDescribe: z.boolean().default(false),
	stats: z.boolean().default(true),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
});

/**
 * Validate CLI options using Zod schema
 * @throws CliOptionsError if validation fails
 */
function validateCliOptions(options: unknown): PlaywrightGeneratorOptions {
	try {
		const validated = CliOptionsSchema.parse(options);
		return {
			input: validated.input,
			output: validated.output,
			outputClient: validated.outputClient,
			outputService: validated.outputService,
			generateService: validated.generateService,
			validateServiceRequest: validated.validateServiceRequest,
			mode: validated.mode,
			typeMode: validated.typeMode,
			enumType: validated.enumType,
			nativeEnumType: validated.nativeEnumType,
			includeDescriptions: validated.descriptions,
			useDescribe: validated.useDescribe,
			showStats: validated.stats,
			prefix: validated.prefix,
			suffix: validated.suffix,
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			const formattedErrors = error.issues.map(err => `  - ${err.path.join(".")}: ${err.message}`).join("\n");
			throw new CliOptionsError(
				`Invalid CLI options:\n${formattedErrors}\n\nPlease check your command line arguments.`,
				error
			);
		}
		throw error;
	}
}

const program = new Command();

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

program
	.name("openapi-to-zod-playwright")
	.description("Generate Playwright API clients from OpenAPI specifications")
	.version(packageJson.version);

program
	.requiredOption("-i, --input <path>", "Input OpenAPI specification file (YAML or JSON)")
	.requiredOption("-o, --output <path>", "Output file path for generated code")
	.option("--output-client <path>", "Optional output file path for client class (separate file)")
	.option("--output-service <path>", "Optional output file path for service class (separate file)")
	.option("--no-generate-service", "Disable service class generation (only generate client)")
	.option("--validate-service-request", "Enable Zod validation for service method request bodies")
	.option("-m, --mode <mode>", "Validation mode: strict, normal, or loose", "normal")
	.option("--type-mode <mode>", "Type mode: inferred or native", "inferred")
	.option("--enum-type <type>", "Enum type: zod or typescript", "zod")
	.option("--native-enum-type <type>", "Native enum type: union or enum (when type-mode=native)", "union")
	.option("--no-descriptions", "Exclude JSDoc descriptions from generated code")
	.option("--use-describe", "Add .describe() calls for runtime descriptions")
	.option("--no-stats", "Hide generation statistics")
	.option("-p, --prefix <prefix>", "Prefix for schema names")
	.option("--suffix <suffix>", "Suffix for schema names")
	.action(options => {
		try {
			// Validate CLI options with Zod
			const generatorOptions = validateCliOptions(options);

			const generator = new PlaywrightGenerator(generatorOptions);
			generator.generate();
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program.parse();
