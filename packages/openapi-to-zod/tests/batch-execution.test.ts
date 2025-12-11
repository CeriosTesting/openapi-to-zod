import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { executeBatch, getBatchExitCode } from "../src/batch-executor";
import type { GeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Batch Execution", () => {
	describe("Parallel Execution", () => {
		it("should process multiple specs in parallel", async () => {
			const specs: (GeneratorOptions & { output: string })[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					output: TestUtils.getOutputPath("batch-parallel-simple.ts"),
				},
				{
					input: TestUtils.getFixturePath("composition.yaml"),
					output: TestUtils.getOutputPath("batch-parallel-composition.ts"),
				},
			];

			const summary = await executeBatch(specs, "parallel");

			expect(summary.total).toBe(2);
			expect(summary.successful).toBe(2);
			expect(summary.failed).toBe(0);
			expect(existsSync(specs[0].output)).toBe(true);
			expect(existsSync(specs[1].output)).toBe(true);
		});

		it("should collect all errors in parallel mode", async () => {
			const specs: (GeneratorOptions & { output: string })[] = [
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					output: TestUtils.getOutputPath("batch-parallel-invalid.ts"),
				},
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					output: TestUtils.getOutputPath("batch-parallel-valid.ts"),
				},
			];

			const summary = await executeBatch(specs, "parallel");
			expect(summary.successful).toBe(1);
			expect(summary.failed).toBe(1);
			expect(summary.results[0].success).toBe(false);
			expect(summary.results[0].error).toBeDefined();
			expect(summary.results[1].success).toBe(true);
		});

		it("should continue processing all specs even if some fail", async () => {
			const specs: (GeneratorOptions & { output: string })[] = [
				{
					input: TestUtils.getFixturePath("non-existent.yaml"),
					output: TestUtils.getOutputPath("batch-invalid-1.ts"),
				},
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					output: TestUtils.getOutputPath("batch-valid.ts"),
				},
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					output: TestUtils.getOutputPath("batch-invalid-2.ts"),
				},
			];

			const summary = await executeBatch(specs, "parallel");
			expect(summary.successful).toBe(1);
			expect(summary.failed).toBe(2);
			expect(existsSync(specs[1].output)).toBe(true);
		});
	});

	describe("Sequential Execution", () => {
		it("should process multiple specs sequentially", async () => {
			const specs: (GeneratorOptions & { output: string })[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					output: TestUtils.getOutputPath("batch-sequential-simple.ts"),
				},
				{
					input: TestUtils.getFixturePath("constraints.yaml"),
					output: TestUtils.getOutputPath("batch-sequential-constraints.ts"),
				},
			];

			const summary = await executeBatch(specs, "sequential");
			expect(summary.successful).toBe(2);
			expect(summary.failed).toBe(0);
			expect(existsSync(specs[0].output)).toBe(true);
			expect(existsSync(specs[1].output)).toBe(true);
		});

		it("should collect all errors in sequential mode", async () => {
			const specs: GeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					output: TestUtils.getOutputPath("batch-sequential-invalid.ts"),
				},
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					output: TestUtils.getOutputPath("batch-sequential-valid.ts"),
				},
			];

			const summary = await executeBatch(specs, "sequential");
			expect(summary.results[0].success).toBe(false);
			expect(summary.results[0].error).toBeDefined();
			expect(summary.results[1].success).toBe(true);
		});

		it("should process specs in order and continue on failure", async () => {
			const specs: GeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					output: TestUtils.getOutputPath("batch-seq-first.ts"),
				},
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					output: TestUtils.getOutputPath("batch-seq-second.ts"),
				},
				{
					input: TestUtils.getFixturePath("composition.yaml"),
					output: TestUtils.getOutputPath("batch-seq-third.ts"),
				},
			];

			const summary = await executeBatch(specs, "sequential");
			expect(summary.results[0].success).toBe(true);
			expect(summary.results[1].success).toBe(false);
			expect(summary.results[2].success).toBe(true);
		});
	});

	describe("Exit Code Handling", () => {
		it("should return exit code 0 for all successful specs", async () => {
			const specs: GeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					output: TestUtils.getOutputPath("batch-exit-success.ts"),
				},
			];

			const summary = await executeBatch(specs, "parallel");
			expect(getBatchExitCode(summary)).toBe(0);
		});

		it("should return exit code 1 if any spec fails", async () => {
			const specs: GeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("simple.yaml"),
					output: TestUtils.getOutputPath("batch-exit-mixed-1.ts"),
				},
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					output: TestUtils.getOutputPath("batch-exit-mixed-2.ts"),
				},
			];

			const summary = await executeBatch(specs, "parallel");
			expect(getBatchExitCode(summary)).toBe(1);
		});
	});

	describe("Error Reporting", () => {
		it("should report error messages without stack traces", async () => {
			const specs: GeneratorOptions[] = [
				{
					input: TestUtils.getFixturePath("invalid-yaml.yaml"),
					output: TestUtils.getOutputPath("batch-error-report.ts"),
				},
			];

			const summary = await executeBatch(specs, "parallel");
			expect(summary.failed).toBe(1);
			expect(summary.results[0].error).toBeDefined();
			expect(summary.results[0].error).toMatch(/Implicit keys need to be on a single line/);
		});
	});

	describe("Edge Cases", () => {
		it("should throw error if no specs provided", async () => {
			await expect(executeBatch([], "parallel")).rejects.toThrow(/No specs provided/);
		});

		it("should handle large batch of specs", async () => {
			const specs: GeneratorOptions[] = Array.from({ length: 10 }, (_, i) => ({
				input: TestUtils.getFixturePath("simple.yaml"),
				output: TestUtils.getOutputPath(`batch-large-${i}.ts`),
			}));

			const summary = await executeBatch(specs, "parallel");
			expect(summary.successful).toBe(10);
			expect(summary.failed).toBe(0);
		});
	});
});
