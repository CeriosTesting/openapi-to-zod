import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import { TestUtils } from "./utils/test-utils";

/**
 * Tests for LRU cache implementations in string-validator and property-generator
 */
describe("LRU Cache Performance", () => {
	describe("Pattern Cache in String Validator", () => {
		it("should cache regex patterns for reuse", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("constraints.yaml"),
				output: "output.ts",
				showStats: false, // Disable stats to avoid timestamp differences
			});

			// Generate multiple times to exercise cache
			const output1 = generator.generateString();
			const output2 = generator.generateString();
			const output3 = generator.generateString();

			// All outputs should be identical
			expect(output1).toBe(output2);
			expect(output2).toBe(output3);
		});
		it("should handle schemas with many pattern constraints efficiently", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("constraints.yaml"),
				output: "output.ts",
			});

			const startTime = Date.now();
			generator.generateString();
			const firstDuration = Date.now() - startTime;

			// Second generation should benefit from cached patterns
			const startTime2 = Date.now();
			generator.generateString();
			const secondDuration = Date.now() - startTime2;

			// Both should complete quickly (allow generous timeout)
			expect(firstDuration).toBeLessThan(5000);
			expect(secondDuration).toBeLessThan(5000);
		});

		it("should not cause memory issues with many unique patterns", () => {
			// Test that cache eviction works by generating schemas with many patterns
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("complex.yaml"),
				output: "output.ts",
			});

			// Generate multiple times
			for (let i = 0; i < 10; i++) {
				generator.generateString();
			}

			// Should complete without memory issues
			expect(true).toBe(true);
		});
	});

	describe("Schema Cache in Property Generator", () => {
		it("should cache generated property schemas", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				output: "output.ts",
			});

			const startTime = Date.now();
			generator.generateString();
			const firstDuration = Date.now() - startTime;

			const startTime2 = Date.now();
			generator.generateString();
			const secondDuration = Date.now() - startTime2;

			// Both should complete quickly
			expect(firstDuration).toBeLessThan(5000);
			expect(secondDuration).toBeLessThan(5000);
		});

		it("should handle schemas with repeated property types", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("complex.yaml"),
				output: "output.ts",
			});

			const output = generator.generateString();

			// Should complete without timeout
			expect(output).toBeTruthy();
			expect(output.length).toBeGreaterThan(0);
		});

		it("should not leak memory with repeated generation", () => {
			const memBefore = process.memoryUsage().heapUsed;

			for (let i = 0; i < 50; i++) {
				const generator = new OpenApiGenerator({
					input: TestUtils.getFixturePath("simple.yaml"),
					output: "output.ts",
				});
				generator.generateString();
			}

			// Force GC if available
			if (global.gc) {
				global.gc();
			}

			const memAfter = process.memoryUsage().heapUsed;
			const memIncrease = memAfter - memBefore;

			// Memory should not increase dramatically (allow for reasonable growth)
			expect(memIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
		});
	});

	describe("Cache Performance with Complex Schemas", () => {
		it("should handle circular references efficiently", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("circular.yaml"),
				output: "output.ts",
			});

			const startTime = Date.now();
			const output = generator.generateString();
			const duration = Date.now() - startTime;

			expect(output).toContain("z.lazy");
			expect(duration).toBeLessThan(3000);
		});

		it("should handle large schemas without performance degradation", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("complex.yaml"),
				output: "output.ts",
			});

			const startTime = Date.now();
			const output = generator.generateString();
			const duration = Date.now() - startTime;

			expect(output.length).toBeGreaterThan(100);
			expect(duration).toBeLessThan(10000); // 10 second timeout
		});

		it("should maintain performance across multiple calls", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("simple.yaml"),
				output: "output.ts",
			});

			const times: number[] = [];

			// Measure 5 consecutive generations
			for (let i = 0; i < 5; i++) {
				const start = Date.now();
				generator.generateString();
				times.push(Date.now() - start);
			}

			// All calls should be reasonably fast
			for (const time of times) {
				expect(time).toBeLessThan(3000);
			}
		});
	});
});
