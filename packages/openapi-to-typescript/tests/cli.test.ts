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
		it("should display help with usage information", () => {
			const output = execSync(`node ${cliPath} --help`, { encoding: "utf-8" });
			expect(output).toContain("Generate TypeScript types");
			expect(output).toContain("init");
			expect(output).toContain("--config");
		});
	});

	describe("init command", () => {
		it("should show help for init command", () => {
			const output = execSync(`node ${cliPath} init --help`, { encoding: "utf-8" });
			expect(output).toContain("Initialize");
		});
	});

	describe("config mode", () => {
		it("should generate types with config file", () => {
			const configPath = TestUtils.getTestConfigDir("openapi-to-typescript.config.json");
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

		it("should generate types with multiple specs", () => {
			const configPath = TestUtils.getTestConfigDir("multi-spec.config.json");
			const outputPath1 = TestUtils.getOutputPath("cli-simple.ts");
			const outputPath2 = TestUtils.getOutputPath("cli-enums.ts");

			const config = {
				specs: [
					{
						input: TestUtils.getFixturePath("simple.yaml"),
						outputTypes: outputPath1,
					},
					{
						input: TestUtils.getFixturePath("enums.yaml"),
						outputTypes: outputPath2,
					},
				],
			};

			writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

			execSync(`node ${cliPath} --config ${configPath}`, { stdio: "pipe" });

			expect(existsSync(outputPath1)).toBe(true);
			expect(existsSync(outputPath2)).toBe(true);
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
			}
		});
	});

	describe("invalid config error", () => {
		it("should show error for invalid config file", () => {
			const configPath = TestUtils.getTestConfigDir("invalid.config.json");
			writeFileSync(configPath, "{ invalid json }", "utf-8");

			try {
				execSync(`node ${cliPath} --config ${configPath}`, {
					encoding: "utf-8",
					stdio: "pipe",
				});
				expect.fail("Should have thrown error");
			} catch (error: any) {
				const output = error.stderr?.toString() || error.stdout?.toString() || error.message;
				expect(output.length).toBeGreaterThan(0);
			}
		});

		it("should not duplicate error message for config validation errors", () => {
			const configPath = TestUtils.getTestConfigDir("openapi-to-typescript.config.json");

			// Create config with old 'output' property instead of 'outputTypes'
			const invalidConfig = {
				specs: [
					{
						input: "openapi.yaml",
						output: "types.ts", // Old property name
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
				expect(stderr).toContain("Did you mean 'outputTypes'");

				// Should NOT contain "Stack trace:" for config validation errors
				expect(stderr).not.toContain("Stack trace:");

				// Count occurrences of "Invalid configuration file" - should be 1
				const matches = stderr.match(/Invalid configuration file/g);
				expect(matches).toHaveLength(1);
			}
		});
	});
});
