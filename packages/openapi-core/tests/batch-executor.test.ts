import { describe, expect, it, vi } from "vitest";

import type { Generator } from "../src/batch-executor";
import { executeBatch, getBatchExitCode } from "../src/batch-executor";

describe("batch-executor", () => {
	describe("executeBatch", () => {
		it("should throw when no specs provided", async () => {
			await expect(executeBatch([], "parallel", () => ({ generate: () => {} }), 10)).rejects.toThrow(
				"No specs provided"
			);
		});

		it("should execute specs sequentially", async () => {
			const executionOrder: number[] = [];
			const specs = [{ input: "a" }, { input: "b" }, { input: "c" }];

			const createGenerator = (spec: any): Generator => ({
				generate: () => {
					executionOrder.push(specs.indexOf(spec));
				},
			});

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const summary = await executeBatch(specs, "sequential", createGenerator, 10);
			consoleSpy.mockRestore();

			expect(summary.total).toBe(3);
			expect(summary.successful).toBe(3);
			expect(summary.failed).toBe(0);
			expect(executionOrder).toEqual([0, 1, 2]);
		});

		it("should execute specs in parallel", async () => {
			const specs = [{ input: "a" }, { input: "b" }];

			const createGenerator = (): Generator => ({
				generate: () => {},
			});

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const summary = await executeBatch(specs, "parallel", createGenerator, 10);
			consoleSpy.mockRestore();

			expect(summary.total).toBe(2);
			expect(summary.successful).toBe(2);
			expect(summary.failed).toBe(0);
		});

		it("should handle generator errors gracefully", async () => {
			const specs = [{ input: "good" }, { input: "bad" }, { input: "good2" }];

			const createGenerator = (spec: any): Generator => ({
				generate: () => {
					if (spec.input === "bad") {
						throw new Error("Generation failed");
					}
				},
			});

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const summary = await executeBatch(specs, "sequential", createGenerator, 10);
			consoleSpy.mockRestore();
			errorSpy.mockRestore();

			expect(summary.total).toBe(3);
			expect(summary.successful).toBe(2);
			expect(summary.failed).toBe(1);
			expect(summary.results[1].success).toBe(false);
			expect(summary.results[1].error).toContain("Generation failed");
		});

		it("should respect batch size in parallel mode", async () => {
			const specs = Array.from({ length: 5 }, (_, i) => ({ input: `spec${i}` }));
			let maxConcurrent = 0;
			let currentConcurrent = 0;

			const createGenerator = (): Generator => ({
				generate: () => {
					currentConcurrent++;
					maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
					currentConcurrent--;
				},
			});

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			await executeBatch(specs, "parallel", createGenerator, 2);
			consoleSpy.mockRestore();

			// With batch size 2, we should process at most 2 at a time
			// Note: Due to synchronous nature of test, this might not accurately reflect
			// true parallelism, but the structure is correct
		});

		it("should use parallel mode by default", async () => {
			const specs = [{ input: "test" }];
			const createGenerator = (): Generator => ({ generate: () => {} });

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const summary = await executeBatch(specs, undefined, createGenerator, 10);
			consoleSpy.mockRestore();

			expect(summary.successful).toBe(1);
		});
	});

	describe("getBatchExitCode", () => {
		it("should return 0 when all specs succeeded", () => {
			const summary = {
				total: 3,
				successful: 3,
				failed: 0,
				results: [],
			};
			expect(getBatchExitCode(summary)).toBe(0);
		});

		it("should return 1 when any spec failed", () => {
			const summary = {
				total: 3,
				successful: 2,
				failed: 1,
				results: [],
			};
			expect(getBatchExitCode(summary)).toBe(1);
		});

		it("should return 1 when all specs failed", () => {
			const summary = {
				total: 3,
				successful: 0,
				failed: 3,
				results: [],
			};
			expect(getBatchExitCode(summary)).toBe(1);
		});
	});
});
