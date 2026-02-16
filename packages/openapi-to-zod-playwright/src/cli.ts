#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
	CliOptionsError,
	ConfigValidationError,
	executeBatch,
	findSpecFiles,
	getRandomCeriosMessage,
} from "@cerios/openapi-core";
import { Command } from "commander";
import prompts from "prompts";

import { OpenApiPlaywrightGenerator } from "./openapi-playwright-generator";
import { loadConfig, mergeConfigWithDefaults } from "./utils/config-loader";

const program = new Command();

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

program
	.name("openapi-to-zod-playwright")
	.description("Generate type-safe Playwright API clients from OpenAPI specifications with Zod validation")
	.version(packageJson.version)
	.option("-c, --config <path>", "Path to config file (openapi-to-zod-playwright.config.{ts,json})")
	.addHelpText(
		"after",
		`
Examples:
  # Create a new config file
  $ openapi-to-zod-playwright init

  # Generate with auto-discovered config
  $ openapi-to-zod-playwright

  # Generate with custom config path
  $ openapi-to-zod-playwright --config custom.config.ts
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
	.description("Initialize a new openapi-to-zod-playwright configuration file")
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

	// Determine execution mode (always sequential for now, could be configurable)
	const executionMode = "sequential";

	// Extract batchSize from first spec's options or use default
	const batchSize = specs[0]?.batchSize ?? 10;

	// Generate for all specs using batch executor
	executeBatch(specs, executionMode, spec => new OpenApiPlaywrightGenerator(spec), batchSize);
}

/**
 * Initialize a new config file with prompts
 */
async function initConfigFile(): Promise<void> {
	console.log("Welcome to openapi-to-zod-playwright configuration setup!\n");

	// Check for existing config files
	const configFiles = ["openapi-to-zod-playwright.config.ts", "openapi-to-zod-playwright.config.json"];

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
			message: "Output file path for schemas and types:",
			initial: "tests/schemas.ts",
			validate: value => value.length > 0 || "Output path is required",
		},
		{
			type: "text",
			name: "outputClient",
			message: "Output file path for client class:",
			initial: "tests/client.ts",
			validate: value => value.length > 0 || "Client output path is required",
		},
		{
			type: "text",
			name: "outputService",
			message: "Output file path for service class (leave empty to skip):",
			initial: "",
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
	if (!response.output || !response.outputClient || !response.format) {
		console.log("\nInitialization cancelled.");
		return;
	}

	const { output, outputClient, outputService, format, includeDefaults } = response;
	const input = inputPath;

	// Generate config content
	let configContent: string;
	let configFilename: string;

	if (format === "ts") {
		configFilename = "openapi-to-zod-playwright.config.ts";

		// Build spec object
		const specConfig: string[] = [
			`      input: '${input}',`,
			`      outputTypes: '${output}',`,
			`      outputClient: '${outputClient}',`,
		];
		if (outputService) {
			specConfig.push(`      outputService: '${outputService}',`);
		}

		if (includeDefaults) {
			configContent = `import { defineConfig } from '@cerios/openapi-to-zod-playwright';

export default defineConfig({
  defaults: {
    mode: 'strict',
    includeDescriptions: true,
	useDescribe: false,
    showStats: true,
    validateServiceRequest: false,
  },
  specs: [
    {
${specConfig.join("\n")}
    },
  ],
});
`;
		} else {
			configContent = `import { defineConfig } from '@cerios/openapi-to-zod-playwright';

export default defineConfig({
  specs: [
    {
${specConfig.join("\n")}
    },
  ],
});
`;
		}
	} else {
		configFilename = "openapi-to-zod-playwright.config.json";
		const specObj: any = {
			input,
			outputTypes: output,
			outputClient,
		};
		if (outputService) {
			specObj.outputService = outputService;
		}

		const jsonConfig: any = {
			specs: [specObj],
		};

		if (includeDefaults) {
			jsonConfig.defaults = {
				mode: "normal",
				validateServiceRequest: false,
			};
		}

		configContent = `${JSON.stringify(jsonConfig, null, 2)}\n`;
	}

	// Write config file
	writeFileSync(configFilename, configContent, "utf-8");

	console.log(`\n✓ Created ${configFilename}`);
	console.log("\nNext steps:");
	console.log("  1. Review and customize your config file if needed");
	console.log("  2. Run 'openapi-to-zod-playwright' to generate Playwright API client");

	// Random fun message
	console.log(`${getRandomCeriosMessage()} ... happy hacking! 🎭\n`);
}
