import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTypeScriptLoader } from "../src/utils/typescript-loader";

describe("typescript-loader", () => {
	const tempDir = path.join(__dirname, ".temp-ts-loader-test");

	beforeAll(() => {
		if (!existsSync(tempDir)) {
			mkdirSync(tempDir, { recursive: true });
		}
	});

	afterAll(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	function createTempFile(filename: string, content: string): string {
		const filepath = path.join(tempDir, filename);
		writeFileSync(filepath, content, "utf-8");
		return filepath;
	}

	describe("createTypeScriptLoader", () => {
		it("should load a simple TypeScript config with default export", async () => {
			const filepath = createTempFile(
				"simple-default.config.ts",
				`
				export default {
					input: "test.yaml",
					output: "output.ts",
					mode: "strict"
				};
			`
			);

			const loader = createTypeScriptLoader();
			const config = await loader(filepath, "");

			expect(config).toEqual({
				input: "test.yaml",
				output: "output.ts",
				mode: "strict",
			});
		});

		it("should load a TypeScript config with named exports", async () => {
			const filepath = createTempFile(
				"named-export.config.ts",
				`
				export const input = "test.yaml";
				export const output = "output.ts";
			`
			);

			const loader = createTypeScriptLoader();
			const config = await loader(filepath, "");

			expect(config.input).toBe("test.yaml");
			expect(config.output).toBe("output.ts");
		});

		it("should handle TypeScript types and interfaces", async () => {
			const filepath = createTempFile(
				"with-types.config.ts",
				`
				interface Config {
					input: string;
					output: string;
					specs?: { name: string }[];
				}

				const config: Config = {
					input: "api.yaml",
					output: "generated.ts",
					specs: [{ name: "main" }]
				};

				export default config;
			`
			);

			const loader = createTypeScriptLoader();
			const config = await loader(filepath, "");

			expect(config).toEqual({
				input: "api.yaml",
				output: "generated.ts",
				specs: [{ name: "main" }],
			});
		});

		it("should handle complex TypeScript features", async () => {
			const filepath = createTempFile(
				"complex.config.ts",
				`
				type Mode = "strict" | "normal" | "loose";

				const baseConfig = {
					mode: "strict" as Mode,
					includeDescriptions: true,
				};

				export default {
					...baseConfig,
					input: "openapi.yaml",
					output: "schemas.ts",
				};
			`
			);

			const loader = createTypeScriptLoader();
			const config = await loader(filepath, "");

			expect(config).toEqual({
				mode: "strict",
				includeDescriptions: true,
				input: "openapi.yaml",
				output: "schemas.ts",
			});
		});

		it("should handle arrays and nested objects", async () => {
			const filepath = createTempFile(
				"nested.config.ts",
				`
				export default {
					specs: [
						{ input: "api1.yaml", output: "api1.ts" },
						{ input: "api2.yaml", output: "api2.ts" },
					],
					options: {
						mode: "strict",
						request: {
							mode: "loose",
						},
					},
				};
			`
			);

			const loader = createTypeScriptLoader();
			const config = await loader(filepath, "");

			expect(config.specs).toHaveLength(2);
			expect(config.specs[0].input).toBe("api1.yaml");
			expect(config.options.mode).toBe("strict");
			expect(config.options.request.mode).toBe("loose");
		});

		it("should throw an error for invalid TypeScript syntax", async () => {
			const filepath = createTempFile(
				"invalid-syntax.config.ts",
				`
				export default {
					input: "test.yaml"
					// Missing comma - syntax error
					output: "output.ts"
				};
			`
			);

			const loader = createTypeScriptLoader();

			await expect(loader(filepath, "")).rejects.toThrow();
		});

		it("should throw an error for non-existent file", async () => {
			const loader = createTypeScriptLoader();
			const nonExistentPath = path.join(tempDir, "does-not-exist.config.ts");

			await expect(loader(nonExistentPath, "")).rejects.toThrow();
		});

		it("should handle config with functions (evaluated at load time)", async () => {
			const filepath = createTempFile(
				"with-function.config.ts",
				`
				function getMode(): string {
					return "strict";
				}

				export default {
					input: "api.yaml",
					output: "out.ts",
					mode: getMode(),
				};
			`
			);

			const loader = createTypeScriptLoader();
			const config = await loader(filepath, "");

			expect(config.mode).toBe("strict");
		});

		it("should handle enum-like const objects", async () => {
			const filepath = createTempFile(
				"with-const-enum.config.ts",
				`
				const Modes = {
					STRICT: "strict",
					NORMAL: "normal",
					LOOSE: "loose",
				} as const;

				export default {
					input: "test.yaml",
					output: "out.ts",
					mode: Modes.STRICT,
				};
			`
			);

			const loader = createTypeScriptLoader();
			const config = await loader(filepath, "");

			expect(config.mode).toBe("strict");
		});

		it("should prefer default export over named exports", async () => {
			const filepath = createTempFile(
				"both-exports.config.ts",
				`
				export const namedValue = "ignored";
				export default {
					input: "default.yaml",
					output: "default.ts",
				};
			`
			);

			const loader = createTypeScriptLoader();
			const config = await loader(filepath, "");

			expect(config.input).toBe("default.yaml");
			expect(config.namedValue).toBeUndefined();
		});
	});
});
