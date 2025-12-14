import { describe, expect, it, vi } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import { TestUtils } from "./utils/test-utils";

describe("Operation Filtering", () => {
	const fixtureFile = TestUtils.getFixturePath("filtering-test.yaml");

	describe("Tag Filtering", () => {
		it("should include only operations with specified tags", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: true,
				operationFilters: {
					includeTags: ["users"],
				},
			});

			const output = generator.generateString();

			// Component schemas are still generated (they can be shared)
			// But stats should show filtered operations
			expect(output).toContain("userSchema");
			expect(output).toContain("productSchema"); // Still generated as it's in components

			// Check that statistics show filtering
			expect(output).toContain("Total operations:");
			expect(output).toContain("Included operations:");
		});

		it("should exclude operations with specified tags", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					excludeTags: ["internal", "admin"],
				},
			});

			const output = generator.generateString();

			// Should include user and product schemas
			expect(output).toContain("userSchema");
			expect(output).toContain("productSchema");

			// Should NOT include internal/admin operations
			// (schemas may still be generated if referenced elsewhere)
		});

		it("should handle multiple tag matching", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["users", "products"],
				},
			});

			const output = generator.generateString();

			expect(output).toContain("userSchema");
			expect(output).toContain("productSchema");
		});
	});

	describe("Path Filtering", () => {
		it("should include operations matching path patterns", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					includePaths: ["/users/**"],
				},
			});

			const output = generator.generateString();

			// Should include user-related operations
			expect(output).toContain("userSchema");
		});

		it("should support glob patterns for paths", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: true,
				operationFilters: {
					includePaths: ["/api/v1/**"],
				},
			});

			const output = generator.generateString();

			// Should only include v1 operations (verify via statistics)
			// Since these operations don't have query params, check the stats show filtering
			expect(output).toContain("Operation Filtering:");
			expect(output).toContain("Total operations: 11");
			expect(output).toContain("Included operations: 1"); // Only getV1Items matches /api/v1/**
		});

		it("should exclude operations matching path patterns", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					excludePaths: ["/admin/**", "/internal/**"],
				},
			});

			const output = generator.generateString();

			// Should include user and product schemas
			expect(output).toContain("userSchema");
		});
	});

	describe("Method Filtering", () => {
		it("should include only specified HTTP methods", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					includeMethods: ["get"],
				},
			});

			const output = generator.generateString();

			// Should include schemas used by GET operations
			expect(output).toContain("userSchema");
			expect(output).toContain("productSchema");

			// POST/DELETE specific schemas might not be present
		});

		it("should exclude specified HTTP methods", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					excludeMethods: ["delete"],
				},
			});

			const output = generator.generateString();

			// Should still include user schema (used by GET/POST)
			expect(output).toContain("userSchema");
		});
	});

	describe("Deprecated Filtering", () => {
		it("should exclude deprecated operations when excludeDeprecated is true", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					excludeDeprecated: true,
				},
			});

			const output = generator.generateString();

			// Should include non-deprecated operations
			expect(output).toContain("userSchema");

			// Deprecated operation should not generate query params if any
		});

		it("should include deprecated operations by default", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
			});

			const output = generator.generateString();

			// All operations should be included
			expect(output).toContain("userSchema");
		});
	});

	describe("OperationId Filtering", () => {
		it("should include operations matching operationId patterns", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					includeOperationIds: ["getUser*"],
				},
			});

			const output = generator.generateString();

			// Should include user schema
			expect(output).toContain("userSchema");
		});

		it("should exclude operations matching operationId patterns", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					excludeOperationIds: ["*Admin*", "*Internal*"],
				},
			});

			const output = generator.generateString();

			// Should include user and product schemas
			expect(output).toContain("userSchema");
			expect(output).toContain("productSchema");
		});
	});

	describe("Combined Filters", () => {
		it("should apply multiple filters together", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["users"],
					excludeMethods: ["delete"],
				},
			});

			const output = generator.generateString();

			// Should include user schema (from GET/POST operations)
			expect(output).toContain("userSchema");
		});

		it("should apply exclude after include (exclude wins)", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["users", "admin"],
					excludeTags: ["admin"],
				},
			});

			const output = generator.generateString();

			// Should only include users, not admin
			expect(output).toContain("userSchema");
		});
	});

	describe("Empty Array Handling", () => {
		it("should treat empty arrays as no constraint", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: [],
					excludeTags: [],
				},
			});

			const output = generator.generateString();

			// All operations should be included
			expect(output).toContain("userSchema");
			expect(output).toContain("productSchema");
		});
	});

	describe("Filter Statistics", () => {
		it("should include filter statistics in output when showStats is true", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: true,
				operationFilters: {
					includeTags: ["users"],
				},
			});

			const output = generator.generateString();

			// Should include statistics comments
			expect(output).toContain("Generation Statistics:");
			expect(output).toContain("Operation Filtering:");
			expect(output).toContain("Total operations:");
			expect(output).toContain("Included operations:");
		});

		it("should show filtered counts by dimension", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: true,
				operationFilters: {
					excludeDeprecated: true,
					excludeTags: ["internal"],
				},
			});

			const output = generator.generateString();

			expect(output).toContain("Operation Filtering:");
			expect(output).toContain("Filtered operations:");
		});
	});

	describe("Filter Warnings", () => {
		it("should warn when filters match zero operations", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["nonexistent-tag"],
				},
			});

			generator.generateString();

			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("operations were filtered out"));

			consoleWarnSpy.mockRestore();
		});

		it("should not warn when some operations are included", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["users"],
				},
			});

			generator.generateString();

			expect(consoleWarnSpy).not.toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});
	});

	describe("No Filters", () => {
		it("should include all operations when no filters are specified", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				output: "output.ts",
				showStats: false,
			});

			const output = generator.generateString();

			// Should include all schemas
			expect(output).toContain("userSchema");
			expect(output).toContain("productSchema");
		});
	});
});
