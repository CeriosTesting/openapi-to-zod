import { existsSync, unlinkSync } from "node:fs";

import { executeBatch, getBatchExitCode } from "@cerios/openapi-core";
import { afterAll, describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";

import { TestUtils } from "./utils/test-utils";

describe("Batch Execution", () => {
	const outputFiles: string[] = [];

	afterAll(() => {
		// Clean up all generated output files
		for (const file of outputFiles) {
			if (existsSync(file)) {
				unlinkSync(file);
			}
		}
		outputFiles.length = 0;
	});
	describe("Parallel Execution", () => {
		it("should process multiple specs in parallel", async () => {
			const specs: (OpenApiGeneratorOptions & { outputTypes: string })[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-parallel-simple.ts"),
				},
				{
					input: TestUtils.getFixturePath("composition.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-parallel-composition.ts"),
				},
			];

			outputFiles.push(...specs.map(s => s.outputTypes));

			const summary = await executeBatch(specs, "parallel", spec => new OpenApiGenerator(spec), 10);

			expect(summary.total).toBe(2);
			expect(summary.successful).toBe(2);
			expect(summary.failed).toBe(0);
			expect(existsSync(specs[0].outputTypes)).toBe(true);
			expect(existsSync(specs[1].outputTypes)).toBe(true);
		});

		it("should collect all errors in parallel mode", async () => {
			const specs: (OpenApiGeneratorOptions & { outputTypes: string })[] = [
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-parallel-invalid.ts"),
				},
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-parallel-valid.ts"),
				},
			];

			outputFiles.push(...specs.map(s => s.outputTypes));

			const summary = await executeBatch(specs, "parallel", spec => new OpenApiGenerator(spec), 10);
			expect(summary.successful).toBe(1);
			expect(summary.failed).toBe(1);
			expect(summary.results[0].success).toBe(false);
			expect(summary.results[0].error).toBeDefined();
			expect(summary.results[1].success).toBe(true);
		});

		it("should continue processing all specs even if some fail", async () => {
			const specs: (OpenApiGeneratorOptions & { outputTypes: string })[] = [
				{
					input: TestUtils.getFixturePath("non-existent.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-invalid-1.ts"),
				},
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-valid.ts"),
				},
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-invalid-2.ts"),
				},
			];

			outputFiles.push(...specs.map(s => s.outputTypes));

			const summary = await executeBatch(specs, "parallel", spec => new OpenApiGenerator(spec), 10);
			expect(summary.successful).toBe(1);
			expect(summary.failed).toBe(2);
			expect(existsSync(specs[1].outputTypes)).toBe(true);
		});
	});

	describe("Sequential Execution", () => {
		it("should process multiple specs sequentially", async () => {
			const specs: (OpenApiGeneratorOptions & { outputTypes: string })[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-sequential-simple.ts"),
				},
				{
					input: TestUtils.getFixturePath("constraints.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-sequential-constraints.ts"),
				},
			];

			outputFiles.push(...specs.map(s => s.outputTypes));

			const summary = await executeBatch(specs, "sequential", spec => new OpenApiGenerator(spec), 10);
			expect(summary.successful).toBe(2);
			expect(summary.failed).toBe(0);
			expect(existsSync(specs[0].outputTypes)).toBe(true);
			expect(existsSync(specs[1].outputTypes)).toBe(true);
		});

		it("should collect all errors in sequential mode", async () => {
			const specs: OpenApiGeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-sequential-invalid.ts"),
				},
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-sequential-valid.ts"),
				},
			];

			outputFiles.push(...specs.map(s => s.outputTypes).filter((o): o is string => o !== undefined));

			const summary = await executeBatch(specs, "sequential", spec => new OpenApiGenerator(spec), 10);
			expect(summary.results[0].success).toBe(false);
			expect(summary.results[0].error).toBeDefined();
			expect(summary.results[1].success).toBe(true);
		});

		it("should process specs in order and continue on failure", async () => {
			const specs: OpenApiGeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-seq-first.ts"),
				},
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-seq-second.ts"),
				},
				{
					input: TestUtils.getFixturePath("composition.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-seq-third.ts"),
				},
			];

			outputFiles.push(...specs.map(s => s.outputTypes).filter((o): o is string => o !== undefined));

			const summary = await executeBatch(specs, "sequential", spec => new OpenApiGenerator(spec), 10);
			expect(summary.results[0].success).toBe(true);
			expect(summary.results[1].success).toBe(false);
			expect(summary.results[2].success).toBe(true);
		});
	});

	describe("Exit Code Handling", () => {
		it("should return exit code 0 for all successful specs", async () => {
			const specs: OpenApiGeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-exit-success.ts"),
				},
			];

			outputFiles.push(...specs.map(s => s.outputTypes).filter((o): o is string => o !== undefined));

			const summary = await executeBatch(specs, "parallel", spec => new OpenApiGenerator(spec), 10);
			const exitCode = getBatchExitCode(summary);

			expect(exitCode).toBe(0);
			expect(summary.successful).toBe(1);
			expect(summary.failed).toBe(0);
		});

		it("should return exit code 1 if any spec fails", async () => {
			const specs: OpenApiGeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-exit-mixed-1.ts"),
				},
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-exit-mixed-2.ts"),
				},
			];

			outputFiles.push(...specs.map(s => s.outputTypes).filter((o): o is string => o !== undefined));

			const summary = await executeBatch(specs, "parallel", spec => new OpenApiGenerator(spec), 10);
			const exitCode = getBatchExitCode(summary);

			expect(exitCode).toBe(1);
			expect(summary.successful).toBe(1);
			expect(summary.failed).toBe(1);
		});
	});

	describe("Error Reporting", () => {
		it("should report error messages without stack traces", async () => {
			const specs: OpenApiGeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					outputTypes: TestUtils.getOutputPath("batch-error-report.ts"),
				},
			];

			outputFiles.push(...specs.map(s => s.outputTypes).filter((o): o is string => o !== undefined));

			const summary = await executeBatch(specs, "parallel", spec => new OpenApiGenerator(spec), 10);
			expect(summary.failed).toBe(1);
			expect(summary.results[0].error).toBeDefined();
			expect(summary.results[0].error).toMatch(/Implicit keys need to be on a single line/);
		});
	});

	describe("Edge Cases", () => {
		it("should throw error if no specs provided", async () => {
			await expect(executeBatch([], "parallel", spec => new OpenApiGenerator(spec), 10)).rejects.toThrow(
				/No specs provided/
			);
		});

		it("should handle large batch of specs", async () => {
			const specs: OpenApiGeneratorOptions[] = Array.from({ length: 10 }, (_, i) => ({
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: TestUtils.getOutputPath(`batch-large-${i}.ts`),
			}));

			outputFiles.push(...specs.map(s => s.outputTypes).filter((o): o is string => o !== undefined));

			const summary = await executeBatch(specs, "parallel", spec => new OpenApiGenerator(spec), 10);
			expect(summary.successful).toBe(10);
			expect(summary.failed).toBe(0);
		});
	});
});
