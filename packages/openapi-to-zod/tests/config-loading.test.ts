import { describe, expect, it } from "vitest";
import type { ConfigFile, GeneratorOptions } from "../src/types";
import { loadConfig, mergeCliWithConfig, mergeConfigWithDefaults } from "../src/utils/config-loader";
import { TestUtils } from "./utils/test-utils";

describe("Config Loading", () => {
	describe("loadConfig", () => {
		it("should load JSON config file from explicit path", async () => {
			const config = await loadConfig(TestUtils.getConfigPath("openapi-to-zod.config.json"));

			expect(config).toBeDefined();
			expect(config.specs).toHaveLength(2);
			expect(config.defaults?.mode).toBe("strict");
			expect(config.executionMode).toBe("parallel");
		});

		it("should load TypeScript config file from explicit path", async () => {
			const config = await loadConfig(TestUtils.getConfigPath("openapi-to-zod.config.ts"));

			expect(config).toBeDefined();
			expect(config.specs).toHaveLength(2);
			expect(config.defaults?.mode).toBe("strict");
			expect(config.executionMode).toBe("parallel");
		});

		it("should throw error for non-existent config file", async () => {
			const configPath = TestUtils.getConfigPath("non-existent.json");

			await expect(loadConfig(configPath)).rejects.toThrow(/no such file or directory|Config file not found/);
		});

		it("should throw error for invalid config structure", async () => {
			const configPath = TestUtils.getConfigPath("invalid-config.json");
			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid configuration file/);
		});

		it("should reject config with unknown properties (strict validation)", async () => {
			const configPath = TestUtils.getConfigPath("invalid-config.json");

			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid configuration file/);
		});

		it("should validate that at least one spec is required", async () => {
			const configPath = TestUtils.getConfigPath("empty-specs-config.json");

			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid configuration file/);
		});
	});

	describe("mergeConfigWithDefaults", () => {
		it("should merge global defaults with spec configs", () => {
			const config: ConfigFile = {
				defaults: {
					mode: "strict",
					includeDescriptions: true,
					enumType: "zod",
					showStats: false,
				},
				specs: [
					{ input: "api.yaml", output: "api.ts" },
					{ input: "api2.yaml", output: "api2.ts", mode: "normal" },
				],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged).toHaveLength(2);
			expect(merged[0].mode).toBe("strict");
			expect(merged[0].includeDescriptions).toBe(true);
			expect(merged[0].showStats).toBe(false);

			// Second spec should override mode
			expect(merged[1].mode).toBe("normal");
			expect(merged[1].includeDescriptions).toBe(true);
		});

		it("should handle config without defaults", () => {
			const config: ConfigFile = {
				specs: [{ input: "api.yaml", output: "api.ts", mode: "loose" }],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged).toHaveLength(1);
			expect(merged[0].mode).toBe("loose");
			expect(merged[0].input).toBe("api.yaml");
		});

		it("should preserve spec-specific options that override defaults", () => {
			const config: ConfigFile = {
				defaults: {
					prefix: "default",
					suffix: "dto",
					mode: "strict",
				},
				specs: [
					{
						input: "api.yaml",
						output: "api.ts",
						prefix: "api",
						mode: "normal",
					},
				],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged[0].prefix).toBe("api");
			expect(merged[0].suffix).toBe("dto");
			expect(merged[0].mode).toBe("normal");
		});
	});

	describe("mergeCliWithConfig", () => {
		it("should override config options with CLI options", () => {
			const GeneratorOptions: GeneratorOptions = {
				input: "api.yaml",
				output: "api.ts",
				mode: "normal",
				includeDescriptions: true,
				enumType: "zod",
			};

			const cliOptions: Partial<GeneratorOptions> = {
				mode: "strict",
				prefix: "cli",
			};

			const merged = mergeCliWithConfig(GeneratorOptions, cliOptions);

			expect(merged.mode).toBe("strict");
			expect(merged.prefix).toBe("cli");
			expect(merged.includeDescriptions).toBe(true);
			expect(merged.input).toBe("api.yaml");
		});

		it("should ignore undefined CLI options", () => {
			const GeneratorOptions: GeneratorOptions = {
				input: "api.yaml",
				output: "api.ts",
				mode: "normal",
				showStats: true,
			};

			const cliOptions: Partial<GeneratorOptions> = {
				mode: undefined,
				prefix: "test",
			};

			const merged = mergeCliWithConfig(GeneratorOptions, cliOptions);

			expect(merged.mode).toBe("normal");
			expect(merged.prefix).toBe("test");
		});

		it("should handle empty CLI options", () => {
			const GeneratorOptions: GeneratorOptions = {
				input: "api.yaml",
				output: "api.ts",
				mode: "loose",
			};

			const merged = mergeCliWithConfig(GeneratorOptions, {});

			expect(merged.mode).toBe("loose");
			expect(merged.input).toBe("api.yaml");
		});
	});

	describe("Config priority order", () => {
		it("should respect precedence: CLI > per-spec > defaults", () => {
			const config: ConfigFile = {
				defaults: {
					mode: "normal",
					prefix: "default",
					showStats: true,
				},
				specs: [
					{
						input: "api.yaml",
						output: "api.ts",
						mode: "strict",
						suffix: "model",
					},
				],
			};

			const merged = mergeConfigWithDefaults(config);
			const withCli = mergeCliWithConfig(merged[0], {
				prefix: "cli",
				enumType: "typescript",
			});

			// CLI wins
			expect(withCli.prefix).toBe("cli");
			expect(withCli.enumType).toBe("typescript");

			// Per-spec wins over defaults
			expect(withCli.mode).toBe("strict");
			expect(withCli.suffix).toBe("model");

			// Defaults used when not overridden
			expect(withCli.showStats).toBe(true);
		});
	});
});
