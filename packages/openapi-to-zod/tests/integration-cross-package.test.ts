import { describe, expect, it } from "vitest";
// Import from the local source (during development/testing)
// In production, the Playwright package would import from "@cerios/openapi-to-zod/internal"
import { executeBatch, formatConfigValidationError, type Generator, LRUCache, toPascalCase } from "../src/internal";

/**
 * Integration tests for cross-package shared utilities
 *
 * These tests verify that the openapi-to-zod-playwright package can correctly
 * import and use shared utilities from the core @cerios/openapi-to-zod package.
 *
 * This simulates the production environment where playwright imports core as a peer dependency.
 *
 * @since 1.0.0
 */
describe("Cross-Package Integration: Core → Playwright", () => {
	describe("LRUCache import and usage", () => {
		it("should be importable from core package", () => {
			expect(LRUCache).toBeDefined();
			expect(typeof LRUCache).toBe("function");
		});

		it("should work correctly when instantiated", () => {
			const cache = new LRUCache<string, number>(2);
			cache.set("a", 1);
			cache.set("b", 2);

			expect(cache.get("a")).toBe(1);
			expect(cache.get("b")).toBe(2);
			expect(cache.has("a")).toBe(true);
		});
	});

	describe("toPascalCase import and usage", () => {
		it("should be importable from core package", () => {
			expect(toPascalCase).toBeDefined();
			expect(typeof toPascalCase).toBe("function");
		});

		it("should convert strings correctly", () => {
			expect(toPascalCase("api-client")).toBe("ApiClient");
			expect(toPascalCase("user_name")).toBe("UserName");
		});
	});

	describe("executeBatch and Generator interface", () => {
		it("should be importable from core package", () => {
			expect(executeBatch).toBeDefined();
			expect(typeof executeBatch).toBe("function");
		});

		it("should work with custom Generator implementations", async () => {
			let callCount = 0;

			class MockPlaywrightGenerator implements Generator {
				constructor(private spec: { input: string }) {}
				generate(): void {
					callCount++;
					// Simulate Playwright generator work
					expect(this.spec.input).toBeDefined();
				}
			}

			const specs = [{ input: "spec1.yaml" }, { input: "spec2.yaml" }];
			const result = await executeBatch(specs, "sequential", spec => new MockPlaywrightGenerator(spec), 10);

			expect(callCount).toBe(2);
			expect(result.total).toBe(2);
			expect(result.successful).toBe(2);
			expect(result.failed).toBe(0);
		});
	});

	describe("formatConfigValidationError import and usage", () => {
		it("should be importable from core package", () => {
			expect(formatConfigValidationError).toBeDefined();
			expect(typeof formatConfigValidationError).toBe("function");
		});

		it("should format errors correctly with Playwright-specific notes", () => {
			const mockError = {
				issues: [
					{
						path: ["specs", 0, "input"],
						message: "Required",
					},
				],
			};

			const result = formatConfigValidationError(mockError as any, "config.ts", undefined, [
				"Note: schemaType is always 'all' for Playwright generator",
			]);

			expect(result).toContain("Invalid configuration file");
			expect(result).toContain("specs.0.input: Required");
			expect(result).toContain("Note: schemaType is always 'all' for Playwright generator");
		});
	});

	describe("Version compatibility", () => {
		it("should verify all shared utilities are available", () => {
			// This test ensures that all expected shared utilities are exported
			// and available for import by dependent packages

			// All should be defined
			expect(LRUCache).toBeDefined();
			expect(toPascalCase).toBeDefined();
			expect(executeBatch).toBeDefined();
			expect(formatConfigValidationError).toBeDefined();
		});
	});

	describe("Real-world scenario simulation", () => {
		it("should handle a typical Playwright generator workflow", async () => {
			// Simulate the Playwright package using shared utilities
			const cache = new LRUCache<string, any>(50);

			// Cache a parsed spec
			const specKey = "my-api-spec";
			cache.set(specKey, { openapi: "3.0.0", info: { title: "Test API" } });

			// Use toPascalCase for naming
			const className = toPascalCase("my-api-client");
			expect(className).toBe("MyApiClient");

			// Use executeBatch for processing
			let generatedCount = 0;
			class SimulatedPlaywrightGenerator implements Generator {
				generate(): void {
					generatedCount++;
				}
			}

			await executeBatch([1], "sequential", () => new SimulatedPlaywrightGenerator(), 10);

			expect(generatedCount).toBe(1);
			expect(cache.has(specKey)).toBe(true);
		});
	});
});
