#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { executeBatch } from "@cerios/openapi-to-zod/internal";
import { Command } from "commander";
import prompts from "prompts";
import { CliOptionsError } from "./errors";
import { OpenApiPlaywrightGenerator } from "./openapi-playwright-generator";
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
 * Find OpenAPI spec files in spec/ or specs/ folders
 * @returns Object with files (path + size) and totalCount
 */
function findSpecFiles(): { files: Array<{ path: string; size: string }>; totalCount: number } {
	const specFolders = ["spec", "specs"];
	const validExtensions = [".yaml", ".yml", ".json"];
	const excludePatterns = ["node_modules", ".git", "dist", "build", "coverage"];
	const allFiles: Array<{ path: string; size: string }> = [];

	for (const folder of specFolders) {
		if (!existsSync(folder)) continue;

		try {
			const entries = readdirSync(folder, { recursive: true, encoding: "utf-8" });

			for (const entry of entries) {
				const fullPath = join(folder, entry as string);

				// Skip if path contains excluded patterns
				if (excludePatterns.some(pattern => fullPath.includes(pattern))) continue;

				try {
					const stats = statSync(fullPath);
					if (!stats.isFile()) continue;

					// Check if file has valid extension
					const hasValidExt = validExtensions.some(ext => fullPath.endsWith(ext));
					if (!hasValidExt) continue;

					// Format file size
					const sizeKB = (stats.size / 1024).toFixed(2);
					allFiles.push({ path: fullPath.replace(/\\/g, "/"), size: `${sizeKB} KB` });
				} catch {}
			}
		} catch {}
	}

	// Sort alphabetically
	allFiles.sort((a, b) => a.path.localeCompare(b.path));

	const totalCount = allFiles.length;
	const files = allFiles.slice(0, 20);

	return { files, totalCount };
}

/**
 * Execute config mode (only mode available)
 */
async function executeConfigMode(options: { config?: string }): Promise<void> {
	// Load config file
	let config: PlaywrightConfigFile;
	try {
		config = await loadConfig(options.config);
	} catch {
		throw new CliOptionsError("No config file found. Run 'openapi-to-zod-playwright init' to create one.");
	}

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
			message: "Include commonly-used recommended defaults?",
			initial: true,
		},
	]);

	// Handle user cancellation (Ctrl+C)
	if (!response.output || !response.format) {
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

	// Random fun messages
	const ceriosMessages = [
		"Things just got Cerios!",
		"Getting Cerios about testing!",
		"Cerios business ahead!",
		"Don't take it too Cerios-ly!",
		"Time to get Cerios with Playwright!",
		"We're dead Cerios about API testing!",
		"This is Cerios-ly awesome!",
		"Cerios-ly, you're all set!",
		"You are Cerios right now!",
		"Cerios vibes only!",
	];
	const randomMessage = ceriosMessages[Math.floor(Math.random() * ceriosMessages.length)];
	console.log(`${randomMessage} ... happy hacking! 🎭\n`);
}
