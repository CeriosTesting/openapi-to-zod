import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { TestUtils } from "./utils/test-utils";

describe("CLI", () => {
	const cliPath = TestUtils.getDistPath("cli.js");
	const TEST_CONFIG_DIR = TestUtils.getTestConfigDir();

	beforeEach(() => {
		// Clean up test config directory
		if (existsSync(TEST_CONFIG_DIR)) {
			rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
		}
		mkdirSync(TEST_CONFIG_DIR, { recursive: true });
	});

	afterAll(() => {
		// Final cleanup
		if (existsSync(TEST_CONFIG_DIR)) {
			rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
		}
	});

	describe("--version", () => {
		it("should display version", () => {
			const output = execSync(`node ${cliPath} --version`, { encoding: "utf-8" });
			expect(output).toMatch(/\d+\.\d+\.\d+/);
		});
	});

	describe("--help", () => {
		it("should display help with new usage", () => {
			const output = execSync(`node ${cliPath} --help`, { encoding: "utf-8" });
			expect(output).toContain("Generate Zod v4 schemas");
			expect(output).toContain("init");
			expect(output).toContain("--config");
		});
	});

	describe("init command", () => {
		it("should show help for init command", () => {
			const output = execSync(`node ${cliPath} init --help`, { encoding: "utf-8" });
			expect(output).toContain("Initialize a new openapi-to-zod configuration file");
		});
	});

	describe("config mode", () => {
		it("should generate schemas with config file", () => {
			const configPath = TestUtils.getTestConfigDir("openapi-to-zod.config.json");
			const outputPath = TestUtils.getOutputPath("cli-config-test.ts");

			const config = {
				specs: [
					{
						input: TestUtils.getFixturePath("simple.yaml"),
						outputTypes: outputPath,
					},
				],
			};

			writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

			execSync(`node ${cliPath} --config ${configPath}`, { stdio: "pipe" });

			expect(existsSync(outputPath)).toBe(true);
		});
	});

	describe("missing config error", () => {
		it("should show helpful error when no config found", () => {
			try {
				execSync(`node ${cliPath}`, {
					cwd: TEST_CONFIG_DIR,
					encoding: "utf-8",
					stdio: "pipe",
				});
				expect.fail("Should have thrown error");
			} catch (error: any) {
				const stderr = error.stderr?.toString() || error.stdout?.toString() || error.message;
				expect(stderr).toContain("No config file found");
				expect(stderr).toContain("init");
			}
		});
	});

	describe("config validation errors", () => {
		it("should warn and still generate when deprecated output is used", () => {
			const configPath = TestUtils.getTestConfigDir("openapi-to-zod.config.json");
			const outputPath = TestUtils.getOutputPath("cli-config-deprecated-output.ts");

			const legacyConfig = {
				specs: [
					{
						input: TestUtils.getFixturePath("simple.yaml"),
						output: outputPath,
					},
				],
			};

			writeFileSync(configPath, JSON.stringify(legacyConfig, null, 2), "utf-8");

			const output = execSync(`node ${cliPath} --config ${configPath} 2>&1`, {
				encoding: "utf-8",
			});

			expect(output).toContain("Deprecation warning");
			expect(output).toContain("'output' is deprecated");
			expect(existsSync(outputPath)).toBe(true);
		});

		it("should not duplicate error message for config validation errors", () => {
			const configPath = TestUtils.getTestConfigDir("openapi-to-zod.config.json");

			// Create config with both output keys set to different values
			const invalidConfig = {
				specs: [
					{
						input: "openapi.yaml",
						output: "legacy-schemas.ts",
						outputTypes: "new-schemas.ts",
					},
				],
			};

			writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2), "utf-8");

			try {
				execSync(`node ${cliPath} --config ${configPath}`, {
					encoding: "utf-8",
					stdio: "pipe",
				});
				expect.fail("Should have thrown error");
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
	});
});
