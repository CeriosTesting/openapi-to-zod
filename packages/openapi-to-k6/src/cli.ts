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

import { OpenApiK6Generator } from "./openapi-k6-generator";
import { loadConfig, mergeConfigWithDefaults } from "./utils/config-loader";

const program = new Command();

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

program
	.name("openapi-to-k6")
	.description("Generate type-safe K6 HTTP clients from OpenAPI specifications")
	.version(packageJson.version)
	.option("-c, --config <path>", "Path to config file (openapi-to-k6.config.{ts,json})")
	.option("-i, --input <path>", "Input OpenAPI specification file")
	.option("-o, --output <path>", "Output file path for K6 client")
	.option("-t, --output-types <path>", "Output file path for TypeScript types (separate file)")
	.option("--use-operation-id", "Use operationId for method names")
	.option("--base-path <path>", "Base path to prepend to all endpoints")
	.option("--no-descriptions", "Exclude JSDoc descriptions")
	.option("--no-stats", "Hide generation statistics")
	.addHelpText(
		"after",
		`
Examples:
  # Create a new config file
  $ openapi-to-k6 init

  # Generate with auto-discovered config
  $ openapi-to-k6

  # Generate with specific input/output
  $ openapi-to-k6 --input openapi.yaml --output k6/client.ts

  # Generate with separate types file
  $ openapi-to-k6 --input openapi.yaml --output k6/client.ts --output-types k6/types.ts

  # Generate with custom config path
  $ openapi-to-k6 --config custom.config.ts
`
	)
	.action(async options => {
		try {
			if (options.input && options.output) {
				// Direct CLI mode
				await executeDirectMode(options);
			} else {
				// Config file mode
				await executeConfigMode(options);
			}
		} catch (error) {
			if (error instanceof CliOptionsError || error instanceof ConfigValidationError) {
				console.error(error.message);
				process.exit(1);
			}
			console.error("Error:", error instanceof Error ? error.message : String(error));
			if (error instanceof Error && error.stack && process.env.DEBUG) {
				console.error("\nStack trace:", error.stack);
			}
			process.exit(1);
		}
	});

// Add init command
program
	.command("init")
	.description("Initialize a new openapi-to-k6 configuration file")
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
 * Execute with direct CLI options
 */
async function executeDirectMode(options: {
	input: string;
	outputClient: string;
	outputTypes: string;
	useOperationId?: boolean;
	basePath?: string;
	descriptions?: boolean;
	stats?: boolean;
}): Promise<void> {
	const generator = new OpenApiK6Generator({
		input: options.input,
		outputClient: options.outputClient,
		outputTypes: options.outputTypes,
		useOperationId: options.useOperationId,
		basePath: options.basePath,
		includeDescriptions: options.descriptions !== false,
		showStats: options.stats !== false,
	});

	console.log(`\n${getRandomCeriosMessage()}\n`);
	generator.generate();
	console.log("\n✅ Generation complete!\n");
}

/**
 * Execute config mode
 */
async function executeConfigMode(options: { config?: string }): Promise<void> {
	// Load config file
	const config = await loadConfig(options.config);

	// Merge defaults with specs
	const specs = mergeConfigWithDefaults(config);

	// Determine execution mode
	const executionMode = config.executionMode || "parallel";

	console.log(`\n${getRandomCeriosMessage()}\n`);

	// Generate for all specs using batch executor
	executeBatch(specs, executionMode, spec => new OpenApiK6Generator(spec), 10);

	console.log("\n✅ Generation complete!\n");
}

/**
 * Initialize a new config file with prompts
 */
async function initConfigFile(): Promise<void> {
	console.log("Welcome to openapi-to-k6 configuration setup!\n");

	// Check for existing config files
	const configFiles = ["openapi-to-k6.config.ts", "openapi-to-k6.config.json"];

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
				initial: "openapi.yaml",
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
			initial: "openapi.yaml",
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
			name: "outputClient",
			message: "Output file path for K6 client:",
			initial: "k6/api-client.ts",
			validate: value => value.length > 0 || "Output path is required",
		},
		{
			type: "text",
			name: "outputTypes",
			message: "Output file path for types (leave empty for inline types):",
			initial: "k6/api-types.ts",
		},
		{
			type: "confirm",
			name: "useOperationId",
			message: "Use operationId for method names?",
			initial: false,
		},
		{
			type: "select",
			name: "format",
			message: "Configuration file format:",
			choices: [
				{ title: "TypeScript (.ts)", value: "ts" },
				{ title: "JSON (.json)", value: "json" },
			],
			initial: 0,
		},
	]);

	if (!response.outputClient || !response.outputTypes) {
		console.log("\nInitialization cancelled.");
		return;
	}

	const configFileName = `openapi-to-k6.config.${response.format}`;
	let content: string;

	if (response.format === "ts") {
		content = `import { defineConfig } from "@cerios/openapi-to-k6";

export default defineConfig({
  defaults: {
    includeDescriptions: true,
    showStats: true,
    preferredContentTypes: ["application/json"],
  },
  specs: [
    {
      input: "${inputPath}",
      outputClient: "${response.outputClient}",${response.outputTypes ? `\n      outputTypes: "${response.outputTypes}",` : ""}${response.useOperationId ? "\n      useOperationId: true," : ""}
    },
  ],
});
`;
	} else {
		const spec: Record<string, unknown> = {
			input: inputPath,
			outputClient: response.outputClient,
		};
		if (response.outputTypes) {
			spec.outputTypes = response.outputTypes;
		}
		if (response.useOperationId) {
			spec.useOperationId = true;
		}

		content = JSON.stringify(
			{
				defaults: {
					includeDescriptions: true,
					showStats: true,
					preferredContentTypes: ["application/json"],
				},
				specs: [spec],
			},
			null,
			2
		);
	}

	writeFileSync(configFileName, content, "utf-8");
	console.log(`\n✅ Created ${configFileName}`);
	console.log(`\nNext steps:`);
	console.log(`  1. Review and customize the config file`);
	console.log(`  2. Run 'npx openapi-to-k6' to generate the K6 client`);
}
