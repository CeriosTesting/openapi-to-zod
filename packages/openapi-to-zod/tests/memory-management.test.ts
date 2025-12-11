import { describe, expect, it } from "vitest";
import { executeBatch } from "../src/batch-executor";
import type { GeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Tests for memory management in batch executor
 */
describe("Memory Management", () => {
	describe("Batch Executor Cleanup", () => {
		it("should clean up memory after large batch execution", async () => {
			const specs: GeneratorOptions[] = Array.from({ length: 15 }, (_, i) => ({
				input: TestUtils.getFixturePath("simple.yaml"),
				output: TestUtils.getOutputPath(`memory-test-${i}.ts`),
			}));

			const memBefore = process.memoryUsage().heapUsed;

			const summary = await executeBatch(specs, "sequential");

			// Force GC if available
			if (global.gc) {
				global.gc();
			}

			const memAfter = process.memoryUsage().heapUsed;

			expect(summary.successful).toBe(15);

			// Memory increase should be reasonable (less than 100MB for 15 specs)
			const memIncrease = memAfter - memBefore;
			expect(memIncrease).toBeLessThan(100 * 1024 * 1024);
		}, 30000);

		it("should handle small batches without triggering cleanup", async () => {
			const specs: GeneratorOptions[] = Array.from({ length: 5 }, (_, i) => ({
				input: TestUtils.getFixturePath("simple.yaml"),
				output: TestUtils.getOutputPath(`small-batch-${i}.ts`),
			}));

			const summary = await executeBatch(specs, "parallel");

			expect(summary.successful).toBe(5);
			expect(summary.failed).toBe(0);
		});

		it("should handle very large batches efficiently", async () => {
			const specs: GeneratorOptions[] = Array.from({ length: 25 }, (_, i) => ({
				input: TestUtils.getFixturePath("simple.yaml"),
				output: TestUtils.getOutputPath(`large-batch-${i}.ts`),
			}));

			const memBefore = process.memoryUsage().heapUsed;
			const startTime = Date.now();

			const summary = await executeBatch(specs, "parallel");

			const duration = Date.now() - startTime;

			// Force GC
			if (global.gc) {
				global.gc();
			}

			const memAfter = process.memoryUsage().heapUsed;
			const memIncrease = memAfter - memBefore;

			expect(summary.successful).toBe(25);
			expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
			expect(memIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
		}, 90000);

		it("should not leak memory with repeated small batches", async () => {
			const memBefore = process.memoryUsage().heapUsed;

			// Run 10 small batches
			for (let batch = 0; batch < 10; batch++) {
				const specs: GeneratorOptions[] = Array.from({ length: 3 }, (_, i) => ({
					input: TestUtils.getFixturePath("simple.yaml"),
					output: TestUtils.getOutputPath(`repeat-batch-${batch}-${i}.ts`),
				}));

				await executeBatch(specs, "sequential");
			}

			// Force GC
			if (global.gc) {
				global.gc();
			}

			const memAfter = process.memoryUsage().heapUsed;
			const memIncrease = memAfter - memBefore;

			// Memory should not grow significantly
			expect(memIncrease).toBeLessThan(100 * 1024 * 1024);
		}, 60000);
	});

	describe("Generator Memory Usage", () => {
		it("should not leak memory with repeated single generations", async () => {
			const { ZodSchemaGenerator } = await import("../src/generator.js");
			const memBefore = process.memoryUsage().heapUsed;
			for (let i = 0; i < 100; i++) {
				const generator = new ZodSchemaGenerator({
					input: TestUtils.getFixturePath("simple.yaml"),
				});
				generator.generateString();
			}

			// Force GC
			if (global.gc) {
				global.gc();
			}

			const memAfter = process.memoryUsage().heapUsed;
			const memIncrease = memAfter - memBefore;

			// Should not leak significantly
			expect(memIncrease).toBeLessThan(50 * 1024 * 1024);
		});

		it("should handle complex schemas without memory issues", async () => {
			const { ZodSchemaGenerator } = await import("../src/generator.js");
			for (let i = 0; i < 10; i++) {
				const generator = new ZodSchemaGenerator({
					input: TestUtils.getFixturePath("complex.yaml"),
				});
				generator.generateString();
			}

			// Should complete without crashing
			expect(true).toBe(true);
		});
	});
});
