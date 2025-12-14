import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { executeBatch } from "../src/batch-executor";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Batch Execution with Request/Response Options", () => {
	it("should process multiple specs with different request/response options", async () => {
		const specs: (OpenApiGeneratorOptions & { output: string })[] = [
			{
				input: TestUtils.getFixturePath("type-mode.yaml"),
				output: TestUtils.getOutputPath("batch-mixed-typemode.ts"),
				request: {
					typeMode: "native",
					includeDescriptions: true,
				},
				response: {
					mode: "strict",
				},
			},
			{
				input: TestUtils.getFixturePath("simple.yaml"),
				output: TestUtils.getOutputPath("batch-native-requests.ts"),
				request: {
					typeMode: "native",
				},
				nativeEnumType: "enum",
			},
			{
				input: TestUtils.getFixturePath("composition.yaml"),
				output: TestUtils.getOutputPath("batch-inferred-responses.ts"),
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

		// Verify second spec has native request types but Zod response schemas
		const nativeOutput = readFileSync(specs[1].output, "utf-8");
		expect(nativeOutput).toContain("export type");
		expect(nativeOutput).toContain("export const"); // Response schemas are always Zod
		expect(nativeOutput).toContain('import { z } from "zod"'); // Always imports Zod for responses

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
		};

		const specs: (OpenApiGeneratorOptions & { output: string })[] = [
			{
				input: TestUtils.getFixturePath("simple.yaml"),
				output: TestUtils.getOutputPath("batch-mixed-typemode.ts"),
				...defaults,
			},
			{
				input: TestUtils.getFixturePath("composition.yaml"),
				output: TestUtils.getOutputPath("batch-native-requests.ts"),
				...defaults,
				request: {
					typeMode: "native", // Override to use native for requests
				},
			},
		];

		const summary = await executeBatch(specs, "sequential");

		expect(summary.total).toBe(2);
		expect(summary.successful).toBe(2);

		// First uses default inferred mode
		const defaultOutput = readFileSync(specs[0].output, "utf-8");
		expect(defaultOutput).toContain('import { z } from "zod"');

		// Second uses native for requests, but responses are always Zod
		const overrideOutput = readFileSync(specs[1].output, "utf-8");
		expect(overrideOutput).toContain('import { z } from "zod"'); // Still imports Zod for responses
	});

	it("should handle complex nested options in batch mode", async () => {
		const specs: (OpenApiGeneratorOptions & { output: string })[] = [
			{
				input: TestUtils.getFixturePath("type-mode.yaml"),
				output: TestUtils.getOutputPath("batch-mixed-typemode.ts"),
				mode: "normal", // Root mode
				includeDescriptions: true,
				request: {
					typeMode: "native",
					mode: "strict", // Override for requests
					includeDescriptions: true,
				},
				response: {
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
