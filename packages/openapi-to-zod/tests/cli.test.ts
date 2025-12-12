import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { TestUtils } from "./utils/test-utils";

const TEST_CONFIG_DIR = "tests/cli-config-test";

describe("CLI", () => {
	const cliPath = TestUtils.getDistPath("cli.js");

	beforeEach(() => {
		// Clean up test config directory
		if (existsSync(TEST_CONFIG_DIR)) {
			rmSync(TEST_CONFIG_DIR, { recursive: true });
		}
		mkdirSync(TEST_CONFIG_DIR, { recursive: true });
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
			expect(output).toContain("--init");
			expect(output).toContain("--config");
			expect(output).toContain("Breaking Changes (v2.0)");
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
			const configPath = `${TEST_CONFIG_DIR}/openapi-to-zod.config.json`;
			const outputPath = TestUtils.getOutputPath("cli-config-test.ts");

			const config = {
				specs: [
					{
						input: TestUtils.getFixturePath("simple.yaml"),
						output: outputPath,
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
				expect(stderr).toContain("--init");
			}
		});
	});
});
