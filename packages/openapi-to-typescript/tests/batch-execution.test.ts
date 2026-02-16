import { existsSync, unlinkSync } from "node:fs";

import { executeBatch, getBatchExitCode } from "@cerios/openapi-core";
import { afterEach, describe, expect, it } from "vitest";

import { TypeScriptGenerator } from "../src/typescript-generator";

import { TestUtils } from "./utils/test-utils";

describe("Batch Execution", () => {
	const outputFiles = [
		TestUtils.getOutputPath("batch-simple.ts"),
		TestUtils.getOutputPath("batch-enums.ts"),
		TestUtils.getOutputPath("batch-circular.ts"),
	];

	afterEach(() => {
		// Clean up generated files
		for (const file of outputFiles) {
			if (existsSync(file)) {
				unlinkSync(file);
			}
		}
	});

	describe("executeBatch", () => {
		it("should process multiple specs successfully", async () => {
			const specs = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: outputFiles[0],
				},
				{
					input: TestUtils.getFixturePath("enums.yaml"),
					outputTypes: outputFiles[1],
				},
			];

			const summary = await executeBatch(specs, "parallel", spec => new TypeScriptGenerator(spec), 10);

			expect(summary.total).toBe(2);
			expect(summary.successful).toBe(2);
			expect(summary.failed).toBe(0);
			expect(existsSync(outputFiles[0])).toBe(true);
			expect(existsSync(outputFiles[1])).toBe(true);
		});

		it("should continue processing after failure", async () => {
			const specs = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: outputFiles[0],
				},
				{
					input: "non-existent.yaml", // This will fail
					outputTypes: outputFiles[1],
				},
				{
					input: TestUtils.getFixturePath("enums.yaml"),
					outputTypes: outputFiles[2],
				},
			];

			const summary = await executeBatch(specs, "sequential", spec => new TypeScriptGenerator(spec), 10);

			expect(summary.total).toBe(3);
			expect(summary.successful).toBe(2);
			expect(summary.failed).toBe(1);
		});

		it("should work with parallel execution mode", async () => {
			const specs = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: outputFiles[0],
				},
				{
					input: TestUtils.getFixturePath("enums.yaml"),
					outputTypes: outputFiles[1],
				},
			];

			const summary = await executeBatch(specs, "parallel", spec => new TypeScriptGenerator(spec), 10);

			expect(summary.successful).toBe(2);
		});

		it("should work with sequential execution mode", async () => {
			const specs = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: outputFiles[0],
				},
				{
					input: TestUtils.getFixturePath("enums.yaml"),
					outputTypes: outputFiles[1],
				},
			];

			const summary = await executeBatch(specs, "sequential", spec => new TypeScriptGenerator(spec), 10);

			expect(summary.successful).toBe(2);
		});

		it("should use core fixtures", async () => {
			const specs = [
				{
					input: TestUtils.getCoreFixturePath("references", "circular.yaml"),
					outputTypes: outputFiles[0],
				},
			];

			const summary = await executeBatch(specs, "parallel", spec => new TypeScriptGenerator(spec), 10);

			expect(summary.successful).toBe(1);
			expect(existsSync(outputFiles[0])).toBe(true);
		});
	});

	describe("getBatchExitCode", () => {
		it("should return 0 when all specs succeed", () => {
			const summary = {
				total: 2,
				successful: 2,
				failed: 0,
				results: [],
			};

			expect(getBatchExitCode(summary)).toBe(0);
		});

		it("should return 1 when some specs fail", () => {
			const summary = {
				total: 2,
				successful: 1,
				failed: 1,
				results: [],
			};

			expect(getBatchExitCode(summary)).toBe(1);
		});

		it("should return 1 when all specs fail", () => {
			const summary = {
				total: 2,
				successful: 0,
				failed: 2,
				results: [],
			};

			expect(getBatchExitCode(summary)).toBe(1);
		});
	});
});
