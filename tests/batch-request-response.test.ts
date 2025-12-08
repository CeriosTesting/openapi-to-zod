import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { executeBatch } from "../src/batch-executor";
import type { SpecConfig } from "../src/types";

describe("Batch Execution with Request/Response Options", () => {
	const outputFiles = [
		"tests/output/batch-mixed-typemode.ts",
		"tests/output/batch-native-requests.ts",
		"tests/output/batch-inferred-responses.ts",
	];

	afterEach(() => {
		for (const file of outputFiles) {
			if (existsSync(file)) {
				unlinkSync(file);
			}
		}
	});

	it("should process multiple specs with different request/response options", async () => {
		const specs: SpecConfig[] = [
			{
				name: "Mixed TypeMode",
				input: "tests/fixtures/type-mode.yaml",
				output: "tests/output/batch-mixed-typemode.ts",
				request: {
					typeMode: "native",
					includeDescriptions: true,
				},
				response: {
					typeMode: "inferred",
					mode: "strict",
				},
			},
			{
				name: "All Native",
				input: "tests/fixtures/simple.yaml",
				output: "tests/output/batch-native-requests.ts",
				typeMode: "native",
				nativeEnumType: "enum",
			},
			{
				name: "All Inferred",
				input: "tests/fixtures/composition.yaml",
				output: "tests/output/batch-inferred-responses.ts",
				typeMode: "inferred",
				mode: "normal",
			},
		];

		const summary = await executeBatch(specs, "parallel");

		expect(summary.total).toBe(3);
		expect(summary.successful).toBe(3);
		expect(summary.failed).toBe(0);

		// Verify first spec has mixed types
		const mixedOutput = readFileSync(specs[0].output, "utf-8");
		expect(mixedOutput).toContain("export type CreateUserRequest"); // Native type
		expect(mixedOutput).toContain("export const userSchema"); // Zod schema
		expect(mixedOutput).toContain('import { z } from "zod"'); // Zod import

		// Verify second spec has only native types
		const nativeOutput = readFileSync(specs[1].output, "utf-8");
		expect(nativeOutput).toContain("export type");
		expect(nativeOutput).toContain("export enum"); // TypeScript enum
		expect(nativeOutput).not.toContain('import { z } from "zod"'); // No Zod

		// Verify third spec has Zod schemas
		const inferredOutput = readFileSync(specs[2].output, "utf-8");
		expect(inferredOutput).toContain("export const");
		expect(inferredOutput).toContain("Schema =");
		expect(inferredOutput).toContain('import { z } from "zod"');
	});

	it("should apply global defaults with per-spec overrides", async () => {
		// Simulate config file defaults
		const defaults = {
			includeDescriptions: true,
			typeMode: "inferred" as const,
		};

		const specs: SpecConfig[] = [
			{
				name: "Uses defaults",
				input: "tests/fixtures/simple.yaml",
				output: "tests/output/batch-mixed-typemode.ts",
				...defaults,
			},
			{
				name: "Overrides typeMode",
				input: "tests/fixtures/composition.yaml",
				output: "tests/output/batch-native-requests.ts",
				...defaults,
				typeMode: "native", // Override
			},
		];

		const summary = await executeBatch(specs, "sequential");

		expect(summary.total).toBe(2);
		expect(summary.successful).toBe(2);

		// First uses inferred (default)
		const defaultOutput = readFileSync(specs[0].output, "utf-8");
		expect(defaultOutput).toContain('import { z } from "zod"');

		// Second uses native (override)
		const overrideOutput = readFileSync(specs[1].output, "utf-8");
		expect(overrideOutput).not.toContain('import { z } from "zod"');
	});

	it("should handle complex nested options in batch mode", async () => {
		const specs: SpecConfig[] = [
			{
				name: "Complex Config",
				input: "tests/fixtures/type-mode.yaml",
				output: "tests/output/batch-mixed-typemode.ts",
				mode: "normal", // Root mode
				includeDescriptions: true,
				request: {
					typeMode: "native",
					mode: "strict", // Override for requests
					includeDescriptions: true,
				},
				response: {
					typeMode: "inferred",
					mode: "loose", // Override for responses
					useDescribe: true,
				},
			},
		];

		const summary = await executeBatch(specs, "parallel");

		expect(summary.successful).toBe(1);
		expect(existsSync(specs[0].output)).toBe(true);

		const output = readFileSync(specs[0].output, "utf-8");

		// Should have both native types and Zod schemas
		expect(output).toContain("export type CreateUserRequest");
		expect(output).toContain("export const userSchema");

		// Should include constraint JSDoc for native types
		expect(output).toMatch(/@minLength|@maxLength|@minimum|@maximum/);
	});
});
