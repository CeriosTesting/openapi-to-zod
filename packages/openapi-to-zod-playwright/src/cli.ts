#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import prompts from "prompts";
import { CliOptionsError } from "./errors";
import { PlaywrightGenerator } from "./playwright-generator";
import type { PlaywrightConfigFile } from "./types";
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
  $ openapi-to-zod-playwright --init

  # Generate with auto-discovered config
  $ openapi-to-zod-playwright

  # Generate with custom config path
  $ openapi-to-zod-playwright --config custom.config.ts

Breaking Changes (v2.0):
  CLI options removed. Use configuration file instead.
  Run 'openapi-to-zod-playwright --init' to create a config file.
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
	let config: PlaywrightConfigFile;
	try {
		config = await loadConfig(options.config);
	} catch {
		throw new CliOptionsError("No config file found. Run 'openapi-to-zod-playwright --init' to create one.");
	}

	// Merge defaults with specs
	const specs = mergeConfigWithDefaults(config);

	// Generate for each spec
	for (const spec of specs) {
		const generator = new PlaywrightGenerator(spec);
		generator.generate();
	}
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
			message: "Output file path for schemas and types:",
			initial: "tests/schemas.ts",
			validate: value => value.length > 0 || "Output path is required",
		},
		{
			type: "text",
			name: "outputClient",
			message: "Output file path for client class (leave empty to skip):",
			initial: "",
		},
		{
			type: (_prev, values) => (values.outputClient ? "text" : null),
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
			message: "Include commonly-used defaults? (mode: normal, validateServiceRequest: false)",
			initial: true,
		},
	]);

	// Handle user cancellation (Ctrl+C)
	if (!response.input || !response.output || !response.format) {
		console.log("\nInitialization cancelled.");
		return;
	}

	const { input, output, outputClient, outputService, format, includeDefaults } = response;

	// Generate config content
	let configContent: string;
	let configFilename: string;

	if (format === "ts") {
		configFilename = "openapi-to-zod-playwright.config.ts";

		// Build spec object
		const specConfig: string[] = [`      input: '${input}',`, `      output: '${output}',`];
		if (outputClient) {
			specConfig.push(`      outputClient: '${outputClient}',`);
		}
		if (outputService) {
			specConfig.push(`      outputService: '${outputService}',`);
		}

		if (includeDefaults) {
			configContent = `import { defineConfig } from '@cerios/openapi-to-zod-playwright';

export default defineConfig({
  defaults: {
    mode: 'normal',
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
			output,
		};
		if (outputClient) {
			specObj.outputClient = outputClient;
		}
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
	console.log("Things just got Cerios... happy hacking! 🎭\n");
}
