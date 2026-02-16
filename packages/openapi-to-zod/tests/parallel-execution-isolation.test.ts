import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

/**
 * Tests for parallel execution isolation
 * Ensures that customDateTimeFormatRegex and cacheSize configurations
 * are isolated between concurrent generator instances (parallel-safe)
 */
describe("Parallel Execution Isolation", () => {
	const testDir = join(__dirname, "fixtures", "parallel-isolation-test");

	// Create multiple spec files for testing
	const specFiles: string[] = [];

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });

		// Create 5 different spec files
		for (let i = 0; i < 5; i++) {
			const specPath = join(testDir, `spec-${i}.yaml`);
			const spec = `
openapi: 3.0.0
info:
  title: Test API ${i}
  version: 1.0.0
paths: {}
components:
  schemas:
    Schema${i}:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
          description: Timestamp for spec ${i}
        name:
          type: string
`;
			writeFileSync(specPath, spec.trim());
			specFiles.push(specPath);
		}
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Concurrent generators with different customDateTimeFormatRegex", () => {
		it("should isolate customDateTimeFormatRegex between parallel generators", async () => {
			// Define different patterns for each generator
			const patterns = [
				"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$", // Pattern 0
				undefined, // Use default
				"^\\d{4}/\\d{2}/\\d{2}$", // Pattern 2
				undefined, // Use default
				"^\\d{2}-\\d{2}-\\d{4}$", // Pattern 4
			];

			// Create all generators
			const generators = specFiles.map(
				(input, i) =>
					new OpenApiGenerator({
						input,
						outputTypes: `output-${i}.ts`,
						customDateTimeFormatRegex: patterns[i],
					})
			);

			// Run all generators in parallel
			const outputs = await Promise.all(generators.map(gen => Promise.resolve(gen.generateString())));

			// Verify each output has its expected format
			// Pattern 0: custom regex
			expect(outputs[0]).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$/");
			expect(outputs[0]).not.toContain("z.iso.datetime()");

			// Pattern 1: default
			expect(outputs[1]).toContain("z.iso.datetime()");
			expect(outputs[1]).not.toContain("z.string().regex(");

			// Pattern 2: custom regex
			expect(outputs[2]).toContain("z.string().regex(/^\\d{4}\\/\\d{2}\\/\\d{2}$/");
			expect(outputs[2]).not.toContain("z.iso.datetime()");

			// Pattern 3: default
			expect(outputs[3]).toContain("z.iso.datetime()");
			expect(outputs[3]).not.toContain("z.string().regex(");

			// Pattern 4: custom regex
			expect(outputs[4]).toContain("z.string().regex(/^\\d{2}-\\d{2}-\\d{4}$/");
			expect(outputs[4]).not.toContain("z.iso.datetime()");
		});

		it("should handle stress test with many parallel generators", async () => {
			const numGenerators = 20;
			const configs: Array<{ input: string; pattern: string | undefined }> = [];

			// Alternate between custom patterns and defaults
			for (let i = 0; i < numGenerators; i++) {
				configs.push({
					input: specFiles[i % specFiles.length],
					pattern: i % 2 === 0 ? `^pattern-${i}$` : undefined,
				});
			}

			// Create generators
			const generators = configs.map(
				({ input, pattern }) =>
					new OpenApiGenerator({
						input,
						outputTypes: "output.ts",
						customDateTimeFormatRegex: pattern,
					})
			);

			// Run all in parallel
			const outputs = await Promise.all(generators.map(gen => Promise.resolve(gen.generateString())));

			// Verify isolation
			for (let i = 0; i < numGenerators; i++) {
				if (i % 2 === 0) {
					// Custom pattern
					expect(outputs[i]).toContain(`z.string().regex(/^pattern-${i}$/`);
					expect(outputs[i]).not.toContain("z.iso.datetime()");
				} else {
					// Default
					expect(outputs[i]).toContain("z.iso.datetime()");
					expect(outputs[i]).not.toContain("z.string().regex(");
				}
			}
		});
	});

	describe("Concurrent generators with different cacheSize", () => {
		it("should not share pattern cache between parallel generators", async () => {
			// Create specs with patterns to test cache isolation
			const specWithPattern = join(testDir, "spec-with-pattern.yaml");
			writeFileSync(
				specWithPattern,
				`
openapi: 3.0.0
info:
  title: Pattern Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    PatternSchema:
      type: object
      properties:
        code:
          type: string
          pattern: "^[A-Z]{3}-\\\\d{4}$"
`.trim()
			);

			// Run multiple generators with different cache sizes in parallel
			const generators = [
				new OpenApiGenerator({ input: specWithPattern, outputTypes: "out1.ts", cacheSize: 10 }),
				new OpenApiGenerator({ input: specWithPattern, outputTypes: "out2.ts", cacheSize: 100 }),
				new OpenApiGenerator({ input: specWithPattern, outputTypes: "out3.ts", cacheSize: 1000 }),
			];

			const outputs = await Promise.all(generators.map(gen => Promise.resolve(gen.generateString())));

			// All outputs should have the same pattern escaped correctly
			for (const output of outputs) {
				expect(output).toContain("z.string().regex(/^[A-Z]{3}-\\d{4}$/");
			}
		});
	});

	describe("Mixed configurations in parallel", () => {
		it("should handle mixed custom/default datetime and various cache sizes", async () => {
			const configs = [
				{ customDateTimeFormatRegex: "^pattern-A$", cacheSize: 50 },
				{ customDateTimeFormatRegex: undefined, cacheSize: 100 },
				{ customDateTimeFormatRegex: "^pattern-B$", cacheSize: 200 },
				{ customDateTimeFormatRegex: "", cacheSize: 300 }, // Empty string = default
				{ customDateTimeFormatRegex: "^pattern-C$", cacheSize: 400 },
			];

			const generators = configs.map(
				(config, i) =>
					new OpenApiGenerator({
						input: specFiles[i],
						outputTypes: `output-${i}.ts`,
						...config,
					})
			);

			const outputs = await Promise.all(generators.map(gen => Promise.resolve(gen.generateString())));

			// Verify each generator used its own configuration
			expect(outputs[0]).toContain("z.string().regex(/^pattern-A$/");
			expect(outputs[1]).toContain("z.iso.datetime()");
			expect(outputs[2]).toContain("z.string().regex(/^pattern-B$/");
			expect(outputs[3]).toContain("z.iso.datetime()"); // Empty string = default
			expect(outputs[4]).toContain("z.string().regex(/^pattern-C$/");
		});

		it("should maintain isolation when same spec processed with different configs", async () => {
			// Process the same spec file with different configurations
			const sameSpec = specFiles[0];

			const generators = [
				new OpenApiGenerator({
					input: sameSpec,
					outputTypes: "out1.ts",
					customDateTimeFormatRegex: "^config-1$",
				}),
				new OpenApiGenerator({
					input: sameSpec,
					outputTypes: "out2.ts",
					// No custom format
				}),
				new OpenApiGenerator({
					input: sameSpec,
					outputTypes: "out3.ts",
					customDateTimeFormatRegex: "^config-3$",
				}),
			];

			const outputs = await Promise.all(generators.map(gen => Promise.resolve(gen.generateString())));

			// Each should have its own format
			expect(outputs[0]).toContain("z.string().regex(/^config-1$/");
			expect(outputs[0]).not.toContain("z.iso.datetime()");

			expect(outputs[1]).toContain("z.iso.datetime()");
			expect(outputs[1]).not.toContain("z.string().regex(");

			expect(outputs[2]).toContain("z.string().regex(/^config-3$/");
			expect(outputs[2]).not.toContain("z.iso.datetime()");
		});
	});

	describe("Interleaved creation and generation", () => {
		it("should maintain isolation even when generators are created before any generation", async () => {
			// Create all generators first (before any generation happens)
			const generatorWithCustom = new OpenApiGenerator({
				input: specFiles[0],
				outputTypes: "output1.ts",
				customDateTimeFormatRegex: "^custom-early$",
			});

			const generatorWithDefault = new OpenApiGenerator({
				input: specFiles[1],
				outputTypes: "output2.ts",
			});

			const generatorWithAnotherCustom = new OpenApiGenerator({
				input: specFiles[2],
				outputTypes: "output3.ts",
				customDateTimeFormatRegex: "^custom-late$",
			});

			// Generate in a different order than creation
			const outputDefault = generatorWithDefault.generateString();
			const outputCustomLate = generatorWithAnotherCustom.generateString();
			const outputCustomEarly = generatorWithCustom.generateString();

			// Verify each has its own configuration
			expect(outputDefault).toContain("z.iso.datetime()");
			expect(outputDefault).not.toContain("z.string().regex(");

			expect(outputCustomLate).toContain("z.string().regex(/^custom-late$/");
			expect(outputCustomLate).not.toContain("z.iso.datetime()");

			expect(outputCustomEarly).toContain("z.string().regex(/^custom-early$/");
			expect(outputCustomEarly).not.toContain("z.iso.datetime()");
		});
	});
});
