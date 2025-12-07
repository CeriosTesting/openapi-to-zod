#!/usr/bin/env node
/** biome-ignore-all lint/suspicious/noConsole: Logging for the CLI tool */
import { Command } from "commander";
import { ZodSchemaGenerator } from "./generator";
import type { GeneratorOptions } from "./types";

const program = new Command();

program
	.name("zod-openapi")
	.description("Generate Zod v4 schemas from OpenAPI specifications")
	.version("1.0.0")
	.requiredOption("-i, --input <path>", "Input OpenAPI YAML file path")
	.requiredOption("-o, --output <path>", "Output TypeScript file path")
	.option("-m, --mode <mode>", "Validation mode: strict, normal, or loose", "normal")
	.option("--no-descriptions", "Exclude JSDoc descriptions from generated schemas")
	.option("-e, --enum-type <type>", "Enum type: zod or typescript", "zod")
	.option("--use-describe", "Add .describe() calls for better runtime error messages")
	.option("-s, --schema-type <type>", "Schema type: all, request, or response", "all")
	.option("-p, --prefix <prefix>", "Add prefix to all generated schema names")
	.option("--suffix <suffix>", "Add suffix before 'Schema' in generated names")
	.option("--no-stats", "Exclude generation statistics from output file")
	.action(options => {
		try {
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
			};
			generateZodSchemas(generatorOptions);
			console.log(`✓ Successfully generated schemas at ${options.output}`);
		} catch (error) {
			console.error("Error generating schemas:", error);
			process.exit(1);
		}
	});

program.parse();

function generateZodSchemas(options: GeneratorOptions): void {
	const generator = new ZodSchemaGenerator(options);
	generator.generate();
}
