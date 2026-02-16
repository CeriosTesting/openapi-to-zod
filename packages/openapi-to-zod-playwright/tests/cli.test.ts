import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = join(__dirname, "../dist/cli.js");
const TEST_DIR = join(__dirname, "cli-config-test");

describe("CLI - Playwright", () => {
	beforeEach(() => {
		// Ensure test directory exists and is clean
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	it("should display version", () => {
		const output = execSync(`node ${CLI_PATH} --version`, { encoding: "utf-8" });
		expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("should display help", () => {
		const output = execSync(`node ${CLI_PATH} --help`, { encoding: "utf-8" });
		expect(output).toContain("Generate type-safe Playwright API clients");
		expect(output).toContain("init");
		expect(output).toContain("--config");
	});

	it("should display help for init command", () => {
		const output = execSync(`node ${CLI_PATH} init --help`, { encoding: "utf-8" });
		expect(output).toContain("Initialize a new openapi-to-zod-playwright configuration file");
	});

	it("should generate from config file", () => {
		// Create a test config file
		const configPath = join(TEST_DIR, "openapi-to-zod-playwright.config.json");
		const inputPath = join(__dirname, "fixtures", "simple-api.yaml");
		const outputPath = join(TEST_DIR, "output.ts");
		const outputClientPath = join(TEST_DIR, "client.ts");

		const config = {
			specs: [
				{
					input: inputPath,
					outputTypes: outputPath,
					outputClient: outputClientPath,
					showStats: false,
				},
			],
		};

		writeFileSync(configPath, JSON.stringify(config, null, 2));

		// Run CLI with config
		execSync(`node ${CLI_PATH} --config ${configPath}`, {
			encoding: "utf-8",
			cwd: TEST_DIR,
			stdio: "pipe",
		});

		// Verify output file was created
		expect(existsSync(outputPath)).toBe(true);
	});

	it("should throw error when no config file is found", () => {
		try {
			execSync(`node ${CLI_PATH}`, {
				encoding: "utf-8",
				cwd: TEST_DIR,
				stdio: "pipe",
			});
			expect.fail("Should have thrown an error");
		} catch (error: any) {
			const stderr = error.stderr?.toString() || error.stdout?.toString() || error.message;
			expect(stderr).toContain("No config file found");
			expect(stderr).toContain("init");
		}
	});

	it("should show helpful error with init tip for invalid config", () => {
		const configPath = join(TEST_DIR, "openapi-to-zod-playwright.config.json");

		// Create an invalid config (missing required 'specs' field)
		const invalidConfig = {
			defaults: {
				mode: "strict",
			},
			// Missing specs array
		};

		writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2), "utf-8");

		try {
			execSync(`node ${CLI_PATH} --config ${configPath}`, {
				encoding: "utf-8",
				cwd: TEST_DIR,
				stdio: "pipe",
			});
			expect.fail("Should have thrown an error");
		} catch (error: any) {
			const stderr = error.stderr?.toString() || error.stdout?.toString() || error.message;
			expect(stderr).toContain("Invalid configuration file");
			expect(stderr).toContain("Validation errors:");
			expect(stderr).toContain("specs");
		}
	});

	it("should not duplicate error message for config validation errors", () => {
		const configPath = join(TEST_DIR, "openapi-to-zod-playwright.config.json");

		// Create config with both output keys set to different values
		const invalidConfig = {
			specs: [
				{
					input: "openapi.yaml",
					output: "legacy.ts",
					outputTypes: "new.ts",
					outputClient: "client.ts",
				},
			],
		};

		writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2), "utf-8");

		try {
			execSync(`node ${CLI_PATH} --config ${configPath}`, {
				encoding: "utf-8",
				cwd: TEST_DIR,
				stdio: "pipe",
			});
			expect.fail("Should have thrown an error");
		} catch (error: any) {
			const stderr = error.stderr?.toString() || error.stdout?.toString() || error.message;

			// Should contain the error message
			expect(stderr).toContain("Invalid configuration file");
			expect(stderr).toContain("outputTypes");
			expect(stderr).toContain("deprecated 'output'");

			// Should NOT contain "Stack trace:" for config validation errors
			expect(stderr).not.toContain("Stack trace:");

			// Count occurrences of "Invalid configuration file" - should be 1
			const matches = stderr.match(/Invalid configuration file/g);
			expect(matches).toHaveLength(1);
		}
	});

	it("should warn and still generate when deprecated output is used", () => {
		const configPath = join(TEST_DIR, "openapi-to-zod-playwright.config.json");
		const inputPath = join(__dirname, "fixtures", "simple-api.yaml");
		const outputPath = join(TEST_DIR, "schemas.ts");
		const outputClientPath = join(TEST_DIR, "client.ts");

		const config = {
			specs: [
				{
					input: inputPath,
					output: outputPath,
					outputClient: outputClientPath,
					showStats: false,
				},
			],
		};

		writeFileSync(configPath, JSON.stringify(config, null, 2));

		const output = execSync(`node ${CLI_PATH} --config ${configPath} 2>&1`, {
			encoding: "utf-8",
			cwd: TEST_DIR,
		});

		expect(output).toContain("Deprecation warning");
		expect(output).toContain("'output' is deprecated");
		expect(existsSync(outputPath)).toBe(true);
		expect(existsSync(outputClientPath)).toBe(true);
	});
});
