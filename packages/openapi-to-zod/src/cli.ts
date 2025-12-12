#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import prompts from "prompts";
import { executeBatch, getBatchExitCode } from "./batch-executor";
import { CliOptionsError } from "./errors";
import type { ConfigFile, ExecutionMode } from "./types";
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
  $ openapi-to-zod --init

  # Generate with auto-discovered config
  $ openapi-to-zod

  # Generate with custom config path
  $ openapi-to-zod --config custom.config.ts

Breaking Changes (v2.0):
  CLI options removed. Use configuration file instead.
  Run 'openapi-to-zod --init' to create a config file.
`
	)
	.action(async options => {
		try {
			await executeConfigMode(options);
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
	let config: ConfigFile;
	try {
		config = await loadConfig(options.config);
	} catch {
		throw new CliOptionsError("No config file found. Run 'openapi-to-zod --init' to create one.", {
			configPath: options.config,
		});
	}

	// Merge defaults with specs
	const specs = mergeConfigWithDefaults(config);

	// Determine execution mode
	const executionMode: ExecutionMode = config.executionMode || "parallel";

	// Execute batch
	const summary = await executeBatch(specs, executionMode);

	// Exit with appropriate code
	const exitCode = getBatchExitCode(summary);
	if (exitCode !== 0) {
		process.exit(exitCode);
	}
}

/**
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

	const response = await prompts([
		{
			type: "text",
			name: "input",
			message: "Input OpenAPI file path:",
			initial: "openapi.yaml",
			validate: value => value.length > 0 || "Input path is required",
		},
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
			message: "Include commonly-used defaults? (mode: strict, includeDescriptions: true, showStats: false)",
			initial: true,
		},
	]);

	// Handle user cancellation (Ctrl+C)
	if (!response.input || !response.output || !response.format) {
		console.log("\nInitialization cancelled.");
		return;
	}

	const { input, output, format, includeDefaults } = response;

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
    showStats: false,
  },
  specs: [
    {
      input: '${input}',
      output: '${output}',
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
      output: '${output}',
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
					output,
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
	console.log("Things just got Cerios...\n");
}
