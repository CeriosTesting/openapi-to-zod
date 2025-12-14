import { describe, expect, it, vi } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Operation Filtering", () => {
	const fixtureFile = TestUtils.getFixturePath("filtering-test.yaml");

	describe("Tag Filtering", () => {
		it("should include only operations with specified tags", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				operationFilters: {
					includeTags: ["users"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include user operations
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("createUser");

			// Should NOT include product or admin operations
			expect(clientOutput).not.toContain("getProducts");
			expect(clientOutput).not.toContain("getAdminSettings");
		});

		it("should exclude operations with specified tags", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					excludeTags: ["internal", "admin"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include user and product operations
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getProducts");

			// Should NOT include internal/admin operations
			expect(clientOutput).not.toContain("getInternalMetrics");
			expect(clientOutput).not.toContain("getAdminSettings");
		});

		it("should handle multiple tag matching", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeTags: ["users", "products"],
				},
			});

			const clientOutput = generator.generateClientString();

			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getProducts");
		});
	});

	describe("Path Filtering", () => {
		it("should include operations matching path patterns", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includePaths: ["/users", "/users/**"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include user-related operations
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getUserById");
			expect(clientOutput).toContain("createUser");
			expect(clientOutput).toContain("deleteUser");
		});

		it("should support glob patterns for versioned APIs", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includePaths: ["/api/v1/**"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should only include v1 operations
			expect(clientOutput).toContain("getV1Items");
			expect(clientOutput).not.toContain("getV2Items");
		});

		it("should exclude operations matching path patterns", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					excludePaths: ["/admin/**", "/internal/**"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include user and product operations
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getProducts");

			// Should NOT include admin/internal
			expect(clientOutput).not.toContain("getAdminSettings");
			expect(clientOutput).not.toContain("getInternalMetrics");
		});
	});

	describe("Method Filtering", () => {
		it("should include only specified HTTP methods", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeMethods: ["get"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include GET operations
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getUserById");
			expect(clientOutput).toContain("getProducts");

			// Should NOT include POST/DELETE
			expect(clientOutput).not.toContain("createUser");
			expect(clientOutput).not.toContain("deleteUser");
		});

		it("should exclude specified HTTP methods", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					excludeMethods: ["delete"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include GET/POST
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("createUser");

			// Should NOT include DELETE
			expect(clientOutput).not.toContain("deleteUser");
		});
	});

	describe("Deprecated Filtering", () => {
		it("should exclude deprecated operations when excludeDeprecated is true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					excludeDeprecated: true,
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include non-deprecated operations
			expect(clientOutput).toContain("getUsers");

			// Should NOT include deprecated operation
			expect(clientOutput).not.toContain("getOldEndpoint");
		});

		it("should include deprecated operations by default", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
			});

			const clientOutput = generator.generateClientString();

			// All operations should be included
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getOldEndpoint");
		});
	});

	describe("OperationId Filtering", () => {
		it("should include operations matching operationId patterns", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeOperationIds: ["getUser*"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include getUsers and getUserById
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getUserById");

			// Should NOT include other operations
			expect(clientOutput).not.toContain("createUser");
			expect(clientOutput).not.toContain("getProducts");
		});

		it("should exclude operations matching operationId patterns", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					excludeOperationIds: ["*Admin*", "*Internal*"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include user and product operations
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getProducts");

			// Should NOT include admin/internal operations
			expect(clientOutput).not.toContain("getAdminSettings");
			expect(clientOutput).not.toContain("getInternalMetrics");
		});
	});

	describe("Status Code Filtering", () => {
		it("should include operations with exact status codes", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeStatusCodes: ["200", "201"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include operations with 200/201 responses
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("createUser");
		});

		it("should support status code range patterns", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeStatusCodes: ["2xx"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include operations with any 2xx responses
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("createUser");
		});

		it("should exclude operations with specified status codes", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					excludeStatusCodes: ["5xx"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Operations should still be included (unless they ONLY have 5xx)
			expect(clientOutput).toContain("getUsers");
		});

		it("should combine exact and range status codes", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeStatusCodes: ["200", "4xx"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include operations with 200 or any 4xx
			expect(clientOutput).toContain("getUsers");
		});
	});

	describe("Combined Filters", () => {
		it("should apply multiple filters together", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeTags: ["users"],
					excludeMethods: ["delete"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include GET/POST user operations
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("createUser");

			// Should NOT include DELETE
			expect(clientOutput).not.toContain("deleteUser");
		});

		it("should apply exclude after include (exclude wins)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeTags: ["users", "admin"],
					excludeTags: ["admin"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should only include users, not admin
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).not.toContain("getAdminSettings");
		});

		it("should combine operation and status code filters", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeTags: ["users"],
					includeStatusCodes: ["2xx"],
				},
			});

			const clientOutput = generator.generateClientString();

			// Should include user operations with success responses
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("createUser");
		});
	});

	describe("Empty Array Handling", () => {
		it("should treat empty arrays as no constraint", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeTags: [],
					excludeTags: [],
					includeStatusCodes: [],
					excludeStatusCodes: [],
				},
			});

			const clientOutput = generator.generateClientString();

			// All operations should be included
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getProducts");
			expect(clientOutput).toContain("getAdminSettings");
		});
	});

	describe("Filter Warnings", () => {
		it("should warn when filters match zero operations", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeTags: ["nonexistent-tag"],
				},
			});

			generator.generateClientString();

			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("operations were filtered out"));

			consoleWarnSpy.mockRestore();
		});

		it("should not warn when some operations are included", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				operationFilters: {
					includeTags: ["users"],
				},
			});

			generator.generateClientString();

			expect(consoleWarnSpy).not.toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});
	});

	describe("No Filters", () => {
		it("should include all operations when no filters are specified", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
			});

			const clientOutput = generator.generateClientString();

			// Should include all operations
			expect(clientOutput).toContain("getUsers");
			expect(clientOutput).toContain("getUserById");
			expect(clientOutput).toContain("createUser");
			expect(clientOutput).toContain("deleteUser");
			expect(clientOutput).toContain("getProducts");
			expect(clientOutput).toContain("getAdminSettings");
			expect(clientOutput).toContain("getInternalMetrics");
			expect(clientOutput).toContain("getV1Items");
			expect(clientOutput).toContain("getV2Items");
			expect(clientOutput).toContain("getOldEndpoint");
		});
	});
});
