#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";

import {
	CliOptionsError,
	ConfigValidationError,
	executeBatch,
	findSpecFiles,
	getBatchExitCode,
	getRandomCeriosMessage,
} from "@cerios/openapi-core";
import { Command } from "commander";
import prompts from "prompts";

import { OpenApiGenerator } from "./openapi-generator";
import type { ExecutionMode } from "./types";
import { loadConfig, mergeConfigWithDefaults } from "./utils/config-loader";

const program = new Command();

program
	.name("openapi-to-zod")
	.description("Generate Zod v4 schemas from OpenAPI specifications")
	.version("1.0.0")
	.option("-c, --config <path>", "Path to config file (openapi-to-zod.config.{ts,json})")
	.addHelpText(
		"after",
		`
Examples:
  # Create a new config file
  $ openapi-to-zod init

  # Generate with auto-discovered config
  $ openapi-to-zod

  # Generate with custom config path
  $ openapi-to-zod --config custom.config.ts
`
	)
	.action(async options => {
		try {
			await executeConfigMode(options);
		} catch (error) {
			if (error instanceof CliOptionsError || error instanceof ConfigValidationError) {
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

// Add init command
program
	.command("init")
	.description("Initialize a new openapi-to-zod configuration file")
	.action(async () => {
		try {
			await initConfigFile();
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program.parse();

/**
 * Execute config mode (only mode available)
 */
async function executeConfigMode(options: { config?: string }): Promise<void> {
	// Load config file
	const config = await loadConfig(options.config);

	// Merge defaults with specs
	const specs = mergeConfigWithDefaults(config);

	// Determine execution mode
	const executionMode: ExecutionMode = config.executionMode || "parallel";

	// Extract batchSize from first spec's options or use default
	const batchSize = specs[0]?.batchSize ?? 10;

	// Execute batch with generator factory
	const summary = await executeBatch(specs, executionMode, spec => new OpenApiGenerator(spec), batchSize);

	// Exit with appropriate code
	const exitCode = getBatchExitCode(summary);
	if (exitCode !== 0) {
		process.exit(exitCode);
	}
} /**
 * Initialize a new config file with prompts
 */
async function initConfigFile(): Promise<void> {
	console.log("Welcome to openapi-to-zod configuration setup!\n");

	// Check for existing config files
	const configFiles = ["openapi-to-zod.config.ts", "openapi-to-zod.config.json"];

	const existingConfig = configFiles.find(f => existsSync(f));
	if (existingConfig) {
		const { overwrite } = await prompts({
			type: "confirm",
			name: "overwrite",
			message: `Config file '${existingConfig}' already exists. Overwrite?`,
			initial: false,
		});

		if (!overwrite) {
			console.log("Initialization cancelled.");
			return;
		}
	}

	// Discover spec files
	const { files, totalCount } = findSpecFiles();

	// Show pagination message if needed
	if (totalCount > 20) {
		console.log(`Showing first 20 of ${totalCount} files found. Use manual entry to specify others.\n`);
	}

	let inputPath: string;

	if (files.length > 0) {
		// Show file selection
		const choices = [
			...files.map(f => ({ title: `${f.path} (${f.size})`, value: f.path })),
			{ title: "→ Enter manually...", value: "__MANUAL__" },
		];

		const inputResponse = await prompts({
			type: "select",
			name: "input",
			message: "Select OpenAPI spec file (YAML or JSON):",
			choices,
		});

		if (!inputResponse.input) {
			console.log("\nInitialization cancelled.");
			return;
		}

		if (inputResponse.input === "__MANUAL__") {
			// Manual entry
			const manualResponse = await prompts({
				type: "text",
				name: "input",
				message: "Input OpenAPI file path (YAML or JSON):",
				initial: "openapi.{yaml,yml,json}",
				validate: value => {
					if (value.length === 0) return "Input path is required";
					if (!existsSync(value)) return "⚠️  File does not exist. Continue anyway?";
					return true;
				},
			});

			if (!manualResponse.input) {
				console.log("\nInitialization cancelled.");
				return;
			}

			inputPath = manualResponse.input;
		} else {
			inputPath = inputResponse.input;
		}
	} else {
		// No files found, fall back to text input
		const manualResponse = await prompts({
			type: "text",
			name: "input",
			message: "Input OpenAPI file path (YAML or JSON):",
			initial: "openapi.{yaml,yml,json}",
			validate: value => {
				if (value.length === 0) return "Input path is required";
				if (!existsSync(value)) return "⚠️  File does not exist. Continue anyway?";
				return true;
			},
		});

		if (!manualResponse.input) {
			console.log("\nInitialization cancelled.");
			return;
		}

		inputPath = manualResponse.input;
	}

	const response = await prompts([
		{
			type: "text",
			name: "output",
			message: "Output TypeScript file path:",
			initial: "src/schemas.ts",
			validate: value => value.length > 0 || "Output path is required",
		},
		{
			type: "select",
			name: "format",
			message: "Config file format:",
			choices: [
				{ title: "TypeScript (recommended)", value: "ts" },
				{ title: "JSON", value: "json" },
			],
			initial: 0,
		},
		{
			type: "confirm",
			name: "includeDefaults",
			message: "Include commonly-used recommended defaults?",
			initial: true,
		},
	]);

	// Handle user cancellation (Ctrl+C)
	if (!response.output || !response.format) {
		console.log("\nInitialization cancelled.");
		return;
	}

	const { output, format, includeDefaults } = response;
	const input = inputPath;

	// Generate config content
	let configContent: string;
	let configFilename: string;

	if (format === "ts") {
		configFilename = "openapi-to-zod.config.ts";
		if (includeDefaults) {
			configContent = `import { defineConfig } from '@cerios/openapi-to-zod';

export default defineConfig({
  defaults: {
    mode: 'strict',
    includeDescriptions: true,
	useDescribe: false,
    showStats: true,
	schemaType: 'all',
  },
  specs: [
    {
      input: '${input}',
      outputTypes: '${output}',
    },
  ],
});
`;
		} else {
			configContent = `import { defineConfig } from '@cerios/openapi-to-zod';

export default defineConfig({
  specs: [
    {
      input: '${input}',
      outputTypes: '${output}',
    },
  ],
});
`;
		}
	} else {
		configFilename = "openapi-to-zod.config.json";
		const jsonConfig: any = {
			specs: [
				{
					input,
					outputTypes: output,
				},
			],
		};

		if (includeDefaults) {
			jsonConfig.defaults = {
				mode: "strict",
				includeDescriptions: true,
				showStats: false,
			};
		}

		configContent = `${JSON.stringify(jsonConfig, null, 2)}\n`;
	}

	// Write config file
	writeFileSync(configFilename, configContent, "utf-8");

	console.log(`\n✓ Created ${configFilename}`);
	console.log("\nNext steps:");
	console.log("  1. Review and customize your config file if needed");
	console.log("  2. Run 'openapi-to-zod' to generate schemas\n");

	// Random fun message
	console.log(`${getRandomCeriosMessage()}\n`);
}
