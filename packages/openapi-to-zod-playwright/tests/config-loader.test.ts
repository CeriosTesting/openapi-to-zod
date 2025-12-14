import { describe, expect, it } from "vitest";
import type { OpenApiPlaywrightOpenApiGeneratorOptions, PlaywrightConfigFile } from "../src/types";
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
			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid Playwright configuration file/);
		});

		it("should reject config with unknown properties (strict validation)", async () => {
			const configPath = TestUtils.getConfigPath("invalid-config.json");

			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid Playwright configuration file/);
		});

		it("should validate that at least one spec is required", async () => {
			const configPath = TestUtils.getConfigPath("empty-specs-config.json");

			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid Playwright configuration file/);
		});

		it("should reject schemaType in config (always 'all' for Playwright)", async () => {
			const configPath = TestUtils.getConfigPath("invalid-schema-type-config.json");

			await expect(loadConfig(configPath)).rejects.toThrow(/Invalid Playwright configuration file/);
		});
	});

	describe("mergeConfigWithDefaults", () => {
		it("should merge global defaults with spec configs", () => {
			const config: PlaywrightConfigFile = {
				defaults: {
					mode: "strict",
					includeDescriptions: true,
					enumType: "zod",
					showStats: false,
					validateServiceRequest: false,
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
			expect(merged[0].validateServiceRequest).toBe(false);

			// Second spec should override mode
			expect(merged[1].mode).toBe("normal");
			expect(merged[1].includeDescriptions).toBe(true);
		});

		it("should enforce schemaType: 'all' for all specs", () => {
			const config: PlaywrightConfigFile = {
				defaults: {
					mode: "strict",
				},
				specs: [
					{ input: "api.yaml", output: "api.ts" },
					{ input: "api2.yaml", output: "api2.ts" },
				],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged).toHaveLength(2);
			expect(merged[0].schemaType).toBe("all");
			expect(merged[1].schemaType).toBe("all");
		});

		it("should handle config without defaults", () => {
			const config: PlaywrightConfigFile = {
				specs: [{ input: "api.yaml", output: "api.ts", mode: "loose" }],
			};

			const merged = mergeConfigWithDefaults(config);

			expect(merged).toHaveLength(1);
			expect(merged[0].mode).toBe("loose");
			expect(merged[0].input).toBe("api.yaml");
			expect(merged[0].schemaType).toBe("all");
		});

		it("should preserve spec-specific options that override defaults", () => {
			const config: PlaywrightConfigFile = {
				defaults: {
					prefix: "default",
					suffix: "dto",
					mode: "strict",
					outputClient: "default-client.ts",
				},
				specs: [
					{
						input: "api.yaml",
						output: "api.ts",
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
			expect(merged[0].outputClient).toBe("api-client.ts");
			expect(merged[0].outputService).toBe("api-service.ts");
			expect(merged[0].schemaType).toBe("all");
		});

		it("should handle Playwright-specific options", () => {
			const config: PlaywrightConfigFile = {
				defaults: {
					validateServiceRequest: true,
					outputClient: "client.ts",
				},
				specs: [
					{
						input: "api.yaml",
						output: "api.ts",
					},
					{
						input: "api2.yaml",
						output: "api2.ts",
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
	});

	describe("mergeCliWithConfig", () => {
		it("should override config options with CLI options", () => {
			const specConfig: OpenApiPlaywrightOpenApiGeneratorOptions = {
				input: "api.yaml",
				output: "api.ts",
				mode: "normal",
				includeDescriptions: true,
				enumType: "zod",
				schemaType: "all",
			};

			const cliOptions: Partial<OpenApiPlaywrightOpenApiGeneratorOptions> = {
				mode: "strict",
				prefix: "cli",
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);

			expect(merged.mode).toBe("strict");
			expect(merged.prefix).toBe("cli");
			expect(merged.includeDescriptions).toBe(true);
			expect(merged.input).toBe("api.yaml");
		});

		it("should always enforce schemaType: 'all' even if CLI provides different value", () => {
			const specConfig: OpenApiPlaywrightOpenApiGeneratorOptions = {
				input: "api.yaml",
				output: "api.ts",
				mode: "normal",
				schemaType: "all",
			};

			const cliOptions: Partial<OpenApiPlaywrightOpenApiGeneratorOptions> = {
				mode: "strict",
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);

			expect(merged.schemaType).toBe("all");
			expect(merged.mode).toBe("strict");
		});

		it("should ignore undefined CLI options", () => {
			const specConfig: OpenApiPlaywrightOpenApiGeneratorOptions = {
				input: "api.yaml",
				output: "api.ts",
				mode: "normal",
				showStats: true,
				schemaType: "all",
			};

			const cliOptions: Partial<OpenApiPlaywrightOpenApiGeneratorOptions> = {
				mode: undefined,
				prefix: "test",
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);

			expect(merged.mode).toBe("normal");
			expect(merged.prefix).toBe("test");
			expect(merged.schemaType).toBe("all");
		});

		it("should handle empty CLI options", () => {
			const specConfig: OpenApiPlaywrightOpenApiGeneratorOptions = {
				input: "api.yaml",
				output: "api.ts",
				mode: "loose",
				schemaType: "all",
			};

			const merged = mergeCliWithConfig(specConfig, {});

			expect(merged.mode).toBe("loose");
			expect(merged.input).toBe("api.yaml");
			expect(merged.schemaType).toBe("all");
		});

		it("should handle Playwright-specific CLI options", () => {
			const specConfig: OpenApiPlaywrightOpenApiGeneratorOptions = {
				input: "api.yaml",
				output: "api.ts",
				validateServiceRequest: false,
				schemaType: "all",
			};

			const cliOptions: Partial<OpenApiPlaywrightOpenApiGeneratorOptions> = {
				outputClient: "custom-client.ts",
				outputService: "custom-service.ts",
				validateServiceRequest: true,
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);

			expect(merged.outputClient).toBe("custom-client.ts");
			expect(merged.outputService).toBe("custom-service.ts");
			expect(merged.validateServiceRequest).toBe(true);
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
				validateServiceRequest: true,
			});

			// CLI wins
			expect(withCli.prefix).toBe("cli");
			expect(withCli.enumType).toBe("typescript");
			expect(withCli.validateServiceRequest).toBe(true);

			// Per-spec wins over defaults
			expect(withCli.mode).toBe("strict");
			expect(withCli.suffix).toBe("model");

			// Defaults used when not overridden
			expect(withCli.showStats).toBe(true); // schemaType always enforced
			expect(withCli.schemaType).toBe("all");
		});
	});
});
