#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { PlaywrightGenerator } from "./playwright-generator";
import type { PlaywrightGeneratorOptions } from "./types";

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
			const generatorOptions: PlaywrightGeneratorOptions = {
				input: options.input,
				output: options.output,
				mode: options.mode as "strict" | "normal" | "loose",
				typeMode: options.typeMode as "inferred" | "native",
				enumType: options.enumType as "zod" | "typescript",
				nativeEnumType: options.nativeEnumType as "union" | "enum",
				includeDescriptions: options.descriptions !== false,
				useDescribe: options.useDescribe === true,
				showStats: options.stats !== false,
				prefix: options.prefix,
				suffix: options.suffix,
			};

			const generator = new PlaywrightGenerator(generatorOptions);
			generator.generate();
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: CLI error output
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program.parse();
