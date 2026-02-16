import * as fs from "node:fs";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadConfig, mergeCliWithConfig, mergeConfigWithDefaults } from "../src/utils/config-loader.js";

describe("Config Loader", () => {
	const testDir = path.join(__dirname, "temp-config-test");

	beforeEach(() => {
		if (!fs.existsSync(testDir)) {
			fs.mkdirSync(testDir, { recursive: true });
		}
	});

	afterEach(() => {
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("loadConfig", () => {
		it("should load a JSON config file", async () => {
			const configPath = path.join(testDir, "openapi-to-typescript.config.json");
			const config = {
				specs: [
					{
						input: "api.yaml",
						outputTypes: "types.ts",
					},
				],
			};
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

			const loaded = await loadConfig(configPath);
			expect(loaded.specs).toHaveLength(1);
			expect(loaded.specs[0].input).toBe("api.yaml");
			expect(loaded.specs[0].outputTypes).toBe("types.ts");
		});

		it("should throw error for non-existent file", async () => {
			const configPath = path.join(testDir, "non-existent.json");
			await expect(loadConfig(configPath)).rejects.toThrow();
		});

		it("should load config with defaults", async () => {
			const configPath = path.join(testDir, "openapi-to-typescript.config.json");
			const config = {
				defaults: {
					enumFormat: "union",
				},
				specs: [
					{
						input: "api.yaml",
						outputTypes: "types.ts",
					},
				],
			};
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

			const loaded = await loadConfig(configPath);
			expect(loaded.defaults?.enumFormat).toBe("union");
		});

		it("should load config with multiple specs", async () => {
			const configPath = path.join(testDir, "openapi-to-typescript.config.json");
			const config = {
				specs: [
					{ input: "api1.yaml", outputTypes: "types1.ts" },
					{ input: "api2.yaml", outputTypes: "types2.ts" },
				],
			};
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

			const loaded = await loadConfig(configPath);
			expect(loaded.specs).toHaveLength(2);
		});

		it("should reject config without specs", async () => {
			const configPath = path.join(testDir, "openapi-to-typescript.config.json");
			const config = {
				defaults: {
					enumFormat: "union",
				},
			};
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

			await expect(loadConfig(configPath)).rejects.toThrow();
		});

		it("should load config with executionMode", async () => {
			const configPath = path.join(testDir, "openapi-to-typescript.config.json");
			const config = {
				executionMode: "parallel",
				specs: [
					{ input: "api1.yaml", outputTypes: "types1.ts" },
					{ input: "api2.yaml", outputTypes: "types2.ts" },
				],
			};
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

			const loaded = await loadConfig(configPath);
			expect(loaded.executionMode).toBe("parallel");
		});
	});

	describe("mergeConfigWithDefaults", () => {
		it("should merge defaults with spec config", () => {
			const config = {
				defaults: {
					enumFormat: "union" as const,
				},
				specs: [
					{
						input: "api.yaml",
						outputTypes: "types.ts",
					},
				],
			};

			const merged = mergeConfigWithDefaults(config);
			expect(merged).toHaveLength(1);
			expect(merged[0].enumFormat).toBe("union");
			expect(merged[0].input).toBe("api.yaml");
		});

		it("should allow spec to override defaults", () => {
			const config = {
				defaults: {
					enumFormat: "union" as const,
				},
				specs: [
					{
						input: "api.yaml",
						outputTypes: "types.ts",
						enumFormat: "enum" as const,
					},
				],
			};

			const merged = mergeConfigWithDefaults(config);
			expect(merged[0].enumFormat).toBe("enum");
		});

		it("should handle config without defaults", () => {
			const config = {
				specs: [
					{
						input: "api.yaml",
						outputTypes: "types.ts",
					},
				],
			};

			const merged = mergeConfigWithDefaults(config);
			expect(merged[0].input).toBe("api.yaml");
			expect(merged[0].enumFormat).toBeUndefined();
		});
	});

	describe("mergeCliWithConfig", () => {
		it("should allow CLI to override config", () => {
			const specConfig = {
				input: "api.yaml",
				outputTypes: "types.ts",
				enumFormat: "union" as const,
			};
			const cliOptions = {
				enumFormat: "enum" as const,
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);
			expect(merged.enumFormat).toBe("enum");
			expect(merged.input).toBe("api.yaml");
		});

		it("should not override with undefined CLI values", () => {
			const specConfig = {
				input: "api.yaml",
				outputTypes: "types.ts",
				enumFormat: "union" as const,
			};
			const cliOptions = {
				enumFormat: undefined,
				prefix: undefined,
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);
			expect(merged.enumFormat).toBe("union");
		});

		it("should preserve spec values not in CLI", () => {
			const specConfig = {
				input: "api.yaml",
				outputTypes: "types.ts",
				prefix: "Api",
				suffix: "Type",
			};
			const cliOptions = {
				prefix: "New",
			};

			const merged = mergeCliWithConfig(specConfig, cliOptions);
			expect(merged.prefix).toBe("New");
			expect(merged.suffix).toBe("Type");
		});
	});
});
