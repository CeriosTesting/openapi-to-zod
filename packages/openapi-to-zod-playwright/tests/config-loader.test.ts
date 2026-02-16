import { describe, expect, it, vi } from "vitest";

import type { OpenApiPlaywrightGeneratorOptions, PlaywrightConfigFile } from "../src/types";
import { loadConfig, mergeCliWithConfig, mergeConfigWithDefaults } from "../src/utils/config-loader";

import { TestUtils } from "./utils/test-utils";

describe("Config Loading - Playwright", () => {
	describe("loadConfig", () => {
		it("should load JSON config file from explicit path", async () => {
			const config = await loadConfig(TestUtils.getConfigPath("openapi-to-zod-playwright.config.json"));

			expect(config).toBeDefined();
			expect(config.specs).toHaveLength(2);
			expect(config.defaults?.mode).toBe("strict");
			expect(config.defaults?.validateServiceRequest).toBe(false);
			expect(config.executionMode).toBe("parallel");
		});

		it("should load TypeScript config file from explicit path", async () => {
			const config = await loadConfig(TestUtils.getConfigPath("openapi-to-zod-playwright.config.ts"));

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
			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid configuration file|Unrecognized key/);
		});

		it("should reject config with unknown properties (strict validation)", async () => {
			const configPath = TestUtils.getConfigPath("invalid-config.json");

			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid configuration file|Unrecognized key/);
		});

		it("should validate that at least one spec is required", async () => {
			const configPath = TestUtils.getConfigPath("empty-specs-config.json");

			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid configuration file|At least one spec is required/);
		});

		it("should reject schemaType in config (always 'all' for Playwright)", async () => {
			const configPath = TestUtils.getConfigPath("invalid-schema-type-config.json");

			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid configuration file|Unrecognized key.*schemaType/);
		});

		it("should accept useOperationId option in config", async () => {
			const config: PlaywrightConfigFile = {
				specs: [
					{ input: "api.yaml", outputTypes: "api.ts", outputClient: "client.ts", useOperationId: true },
					{ input: "api2.yaml", outputTypes: "api2.ts", outputClient: "client2.ts", useOperationId: false },
				],
			};

			// This should not throw - useOperationId is a valid option
			const merged = mergeConfigWithDefaults(config);
			expect(merged[0].useOperationId).toBe(true);
			expect(merged[1].useOperationId).toBe(false);
		});
	});

	describe("mergeConfigWithDefaults", () => {
		it("should merge global defaults with spec configs", () => {
			const config: PlaywrightConfigFile = {
				defaults: {
					mode: "strict",
					includeDescriptions: true,
					showStats: false,
					validateServiceRequest: false,
				},
				specs: [
					{ input: "api.yaml", outputTypes: "api.ts", outputClient: "client.ts" },
					{ input: "api2.yaml", outputTypes: "api2.ts", outputClient: "client2.ts", mode: "normal" },
				],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged).toHaveLength(2);
			expect(merged[0].mode).toBe("strict");
			expect(merged[0].includeDescriptions).toBe(true);
			expect(merged[0].showStats).toBe(false);
			expect(merged[0].validateServiceRequest).toBe(false);

			// Second spec should override mode
			expect(merged[1].mode).toBe("normal");
			expect(merged[1].includeDescriptions).toBe(true);
		});

		it("should handle config without defaults", () => {
			const config: PlaywrightConfigFile = {
				specs: [{ input: "api.yaml", outputTypes: "api.ts", outputClient: "client.ts", mode: "loose" }],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged).toHaveLength(1);
			expect(merged[0].mode).toBe("loose");
			expect(merged[0].input).toBe("api.yaml");
		});

		it("should preserve spec-specific options that override defaults", () => {
			const config: PlaywrightConfigFile = {
				defaults: {
					prefix: "default",
					suffix: "dto",
					mode: "strict",
				},
				specs: [
					{
						input: "api.yaml",
						outputTypes: "api.ts",
						prefix: "api",
						mode: "normal",
						outputClient: "api-client.ts",
						outputService: "api-service.ts",
					},
				],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged[0].prefix).toBe("api");
			expect(merged[0].suffix).toBe("dto");
			expect(merged[0].mode).toBe("normal");
			// outputClient and outputService come from spec, not defaults
			expect(merged[0].outputClient).toBe("api-client.ts");
			expect(merged[0].outputService).toBe("api-service.ts");
		});

		it("should handle Playwright-specific options", () => {
			const config: PlaywrightConfigFile = {
				defaults: {
					validateServiceRequest: true,
				},
				specs: [
					{
						input: "api.yaml",
						outputTypes: "api.ts",
						outputClient: "client.ts",
					},
					{
						input: "api2.yaml",
						outputTypes: "api2.ts",
						validateServiceRequest: false,
						outputClient: "api2-client.ts",
					},
				],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged[0].validateServiceRequest).toBe(true);
			expect(merged[0].outputClient).toBe("client.ts");
			expect(merged[1].validateServiceRequest).toBe(false);
			expect(merged[1].outputClient).toBe("api2-client.ts");
		});

		it("should merge emptyObjectBehavior from defaults", () => {
			const config: PlaywrightConfigFile = {
				defaults: {
					emptyObjectBehavior: "record",
				},
				specs: [
					{ input: "api.yaml", outputTypes: "api.ts", outputClient: "client.ts" },
					{ input: "api2.yaml", outputTypes: "api2.ts", outputClient: "client2.ts", emptyObjectBehavior: "strict" },
				],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged[0].emptyObjectBehavior).toBe("record");
			expect(merged[1].emptyObjectBehavior).toBe("strict");
		});

		it("should accept deprecated output and normalize to outputTypes", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const config = {
				specs: [{ input: "api.yaml", output: "api.ts", outputClient: "client.ts" }],
			} as PlaywrightConfigFile;

			const merged = mergeConfigWithDefaults(config);

			expect(merged).toHaveLength(1);
			expect(merged[0].outputTypes).toBe("api.ts");
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'output' is deprecated"));

			warnSpy.mockRestore();
		});

		it("should allow output and outputTypes when values are equal", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const config = {
				specs: [{ input: "api.yaml", output: "api.ts", outputTypes: "api.ts", outputClient: "client.ts" }],
			} as PlaywrightConfigFile;

			const merged = mergeConfigWithDefaults(config);

			expect(merged[0].outputTypes).toBe("api.ts");
			expect(warnSpy).toHaveBeenCalledTimes(1);

			warnSpy.mockRestore();
		});

		it("should throw when output and outputTypes differ", () => {
			const config = {
				specs: [{ input: "api.yaml", output: "legacy.ts", outputTypes: "new.ts", outputClient: "client.ts" }],
			} as PlaywrightConfigFile;

			expect(() => mergeConfigWithDefaults(config)).toThrow(/cannot have different values/i);
		});

		it("should throw when both output and outputTypes are missing", () => {
			const config = {
				specs: [{ input: "api.yaml", outputClient: "client.ts" }],
			} as PlaywrightConfigFile;

			expect(() => mergeConfigWithDefaults(config)).toThrow(/must define 'outputTypes'.*deprecated 'output'/i);
		});
	});

	describe("mergeCliWithConfig", () => {
		it("should override config options with CLI options", () => {
			const specConfig: OpenApiPlaywrightGeneratorOptions = {
				input: "api.yaml",
				outputTypes: "api.ts",
				outputClient: "client.ts",
				mode: "normal",
				includeDescriptions: true,
			};

			const cliOptions: Partial<OpenApiPlaywrightGeneratorOptions> = {
				mode: "strict",
				prefix: "cli",
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);

			expect(merged.mode).toBe("strict");
			expect(merged.prefix).toBe("cli");
			expect(merged.includeDescriptions).toBe(true);
			expect(merged.input).toBe("api.yaml");
		});

		it("should ignore undefined CLI options", () => {
			const specConfig: OpenApiPlaywrightGeneratorOptions = {
				input: "api.yaml",
				outputTypes: "api.ts",
				outputClient: "client.ts",
				mode: "normal",
				showStats: true,
			};

			const cliOptions: Partial<OpenApiPlaywrightGeneratorOptions> = {
				mode: undefined,
				prefix: "test",
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);

			expect(merged.mode).toBe("normal");
			expect(merged.prefix).toBe("test");
		});

		it("should handle empty CLI options", () => {
			const specConfig: OpenApiPlaywrightGeneratorOptions = {
				input: "api.yaml",
				outputTypes: "api.ts",
				outputClient: "client.ts",
				mode: "loose",
			};

			const merged = mergeCliWithConfig(specConfig, {});

			expect(merged.mode).toBe("loose");
			expect(merged.input).toBe("api.yaml");
		});

		it("should handle Playwright-specific CLI options", () => {
			const specConfig: OpenApiPlaywrightGeneratorOptions = {
				input: "api.yaml",
				outputTypes: "api.ts",
				outputClient: "client.ts",
				validateServiceRequest: false,
			};

			const cliOptions: Partial<OpenApiPlaywrightGeneratorOptions> = {
				outputClient: "custom-client.ts",
				outputService: "custom-service.ts",
				validateServiceRequest: true,
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);

			expect(merged.outputClient).toBe("custom-client.ts");
			expect(merged.outputService).toBe("custom-service.ts");
			expect(merged.validateServiceRequest).toBe(true);
		});

		it("should override emptyObjectBehavior via CLI", () => {
			const specConfig: OpenApiPlaywrightGeneratorOptions = {
				input: "api.yaml",
				outputTypes: "api.ts",
				outputClient: "client.ts",
				emptyObjectBehavior: "loose",
			};

			const cliOptions: Partial<OpenApiPlaywrightGeneratorOptions> = {
				emptyObjectBehavior: "record",
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);

			expect(merged.emptyObjectBehavior).toBe("record");
		});
	});
	describe("Config priority order", () => {
		it("should respect precedence: CLI > per-spec > defaults", () => {
			const config: PlaywrightConfigFile = {
				defaults: {
					mode: "normal",
					prefix: "default",
					showStats: true,
				},
				specs: [
					{
						input: "api.yaml",
						outputTypes: "api.ts",
						outputClient: "client.ts",
						mode: "strict",
						suffix: "model",
					},
				],
			};
			const merged = mergeConfigWithDefaults(config);
			const withCli = mergeCliWithConfig(merged[0], {
				prefix: "cli",
				validateServiceRequest: true,
			});

			// CLI wins
			expect(withCli.prefix).toBe("cli");
			expect(withCli.validateServiceRequest).toBe(true);

			// Per-spec wins over defaults
			expect(withCli.mode).toBe("strict");
			expect(withCli.suffix).toBe("model");

			// Defaults used when not overridden
			expect(withCli.showStats).toBe(true);
		});
	});
});
