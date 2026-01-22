import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

/**
 * Tests for parallel execution isolation in the Playwright generator
 * Ensures that customDateTimeFormatRegex configurations are isolated
 * between concurrent generator instances (parallel-safe)
 */
describe("Parallel DateTime Isolation (Playwright)", () => {
	const testDir = join(__dirname, "fixtures", "parallel-isolation-test");

	// Create multiple spec files for testing
	const specFiles: string[] = [];

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });

		// Create 5 different spec files with endpoints
		for (let i = 0; i < 5; i++) {
			const specPath = join(testDir, `spec-${i}.yaml`);
			const spec = `
openapi: 3.0.0
info:
  title: Test API ${i}
  version: 1.0.0
paths:
  /items:
    get:
      operationId: getItems${i}
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Schema${i}'
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
		it("should isolate customDateTimeFormatRegex between parallel Playwright generators", async () => {
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
					new OpenApiPlaywrightGenerator({
						input,
						output: `output-${i}.ts`,
						outputClient: `client-${i}.ts`,
						customDateTimeFormatRegex: patterns[i],
					})
			);

			// Run all generators in parallel (generate schemas)
			const outputs = await Promise.all(generators.map(gen => Promise.resolve(gen.generateSchemasString())));

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

		it("should handle stress test with many parallel Playwright generators", async () => {
			const numGenerators = 10;
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
				({ input, pattern }, i) =>
					new OpenApiPlaywrightGenerator({
						input,
						output: `output-${i}.ts`,
						outputClient: `client-${i}.ts`,
						customDateTimeFormatRegex: pattern,
					})
			);

			// Run all in parallel
			const outputs = await Promise.all(generators.map(gen => Promise.resolve(gen.generateSchemasString())));

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

	describe("Mixed configurations in parallel", () => {
		it("should handle mixed custom/default datetime", async () => {
			const configs = [
				{ customDateTimeFormatRegex: "^pattern-A$" },
				{ customDateTimeFormatRegex: undefined },
				{ customDateTimeFormatRegex: "^pattern-B$" },
				{ customDateTimeFormatRegex: "" }, // Empty string = default
				{ customDateTimeFormatRegex: "^pattern-C$" },
			];

			const generators = configs.map(
				(config, i) =>
					new OpenApiPlaywrightGenerator({
						input: specFiles[i],
						output: `output-${i}.ts`,
						outputClient: `client-${i}.ts`,
						...config,
					})
			);

			const outputs = await Promise.all(generators.map(gen => Promise.resolve(gen.generateSchemasString())));

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
				new OpenApiPlaywrightGenerator({
					input: sameSpec,
					output: "out1.ts",
					outputClient: "client1.ts",
					customDateTimeFormatRegex: "^config-1$",
				}),
				new OpenApiPlaywrightGenerator({
					input: sameSpec,
					output: "out2.ts",
					outputClient: "client2.ts",
					// No custom format
				}),
				new OpenApiPlaywrightGenerator({
					input: sameSpec,
					output: "out3.ts",
					outputClient: "client3.ts",
					customDateTimeFormatRegex: "^config-3$",
				}),
			];

			const outputs = await Promise.all(generators.map(gen => Promise.resolve(gen.generateSchemasString())));

			// Each should have its own format
			expect(outputs[0]).toContain("z.string().regex(/^config-1$/");
			expect(outputs[0]).not.toContain("z.iso.datetime()");

			expect(outputs[1]).toContain("z.iso.datetime()");
			expect(outputs[1]).not.toContain("z.string().regex(");

			expect(outputs[2]).toContain("z.string().regex(/^config-3$/");
			expect(outputs[2]).not.toContain("z.iso.datetime()");
		});
	});
});
