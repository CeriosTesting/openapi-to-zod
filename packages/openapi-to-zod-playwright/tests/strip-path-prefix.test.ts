import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("stripPathPrefix feature", () => {
	const fixtureFile = TestUtils.getFixturePath("strip-path-prefix.yaml");

	describe("literal string prefix stripping", () => {
		it("should strip exact literal string prefix from paths", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1.0",
				useOperationId: true,
			});

			const clientCode = generator.generateClientString();

			// Method names should use operationId
			expect(clientCode).toContain("async getUsers(");
			expect(clientCode).toContain("async createUser(");
			expect(clientCode).toContain("async getUserById(");
			expect(clientCode).toContain("async getPosts(");

			// JSDoc should show stripped paths
			expect(clientCode).toContain("GET /users");
			expect(clientCode).toContain("POST /users");
			expect(clientCode).toContain("GET /users/{id}");
			expect(clientCode).toContain("GET /posts");

			// Product endpoint should NOT be affected (different version)
			expect(clientCode).toContain("async getProducts(");
			expect(clientCode).toContain("GET /api/v2.5/products");
		});

		it("should handle prefix without leading slash", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "api/v1.0", // No leading slash
			});

			const clientCode = generator.generateClientString();

			// Should normalize and strip correctly
			expect(clientCode).toContain("async getUsers(");
			expect(clientCode).toContain("GET /users");
		});

		it("should handle prefix with trailing slash", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1.0/", // Trailing slash
			});

			const clientCode = generator.generateClientString();

			// Should normalize and strip correctly
			expect(clientCode).toContain("async getUsers(");
			expect(clientCode).toContain("GET /users");
		});

		it("should return original path when prefix doesn't match", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v3.0", // Doesn't match any paths
			});

			const clientCode = generator.generateClientString();

			// Should keep original paths in JSDoc
			expect(clientCode).toContain("GET /api/v1.0/users");
			expect(clientCode).toContain("GET /api/v2.5/products");
		});
	});

	describe("glob pattern prefix stripping", () => {
		it("should strip using glob pattern with version number", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v*", // Matches /api/v1.0, /api/v2.5, etc.
			});

			const clientCode = generator.generateClientString();

			// All endpoints should have prefix stripped
			expect(clientCode).toContain("async getUsers(");
			expect(clientCode).toContain("async getPosts(");
			expect(clientCode).toContain("async getProducts(");

			// JSDoc should show stripped paths
			expect(clientCode).toContain("GET /users");
			expect(clientCode).toContain("GET /posts");
			expect(clientCode).toContain("GET /products");
		});

		it("should detect glob pattern with character classes", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v[0-9]*", // Uses character class
			});

			const clientCode = generator.generateClientString();

			// Should strip all versioned prefixes
			expect(clientCode).toContain("GET /users");
			expect(clientCode).toContain("GET /products");
		});

		it("should use glob with wildcard for flexible matching", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v*.*", // Matches version patterns like v1.0, v2.5
			});

			const clientCode = generator.generateClientString();

			// Should strip entire prefix including version
			expect(clientCode).toContain("GET /users");
			expect(clientCode).toContain("GET /products");
		});
	});

	describe("interaction with basePath option", () => {
		it("should strip prefix then add basePath for actual HTTP calls", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1.0",
				basePath: "/api/v1.0",
			});

			const clientCode = generator.generateClientString();

			// Method names should be from stripped paths
			expect(clientCode).toContain("async getUsers(");

			// JSDoc shows stripped paths
			expect(clientCode).toContain("GET /api/v1.0/users");

			// Actual HTTP calls should include basePath
			expect(clientCode).toMatch(/request\.get\(`\/api\/v1\.0\/users`/);
		});

		it("should work with different stripPrefix and basePath", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v*", // Strip any version with glob
				basePath: "/api/v2.0", // But use v2.0 for actual calls
			});

			const clientCode = generator.generateClientString();

			// Method names from stripped paths
			expect(clientCode).toContain("async getUsers(");

			// HTTP calls use new basePath
			expect(clientCode).toMatch(/request\.get\(`\/api\/v2\.0\/users`/);
		});
	});

	describe("interaction with operation filtering", () => {
		it("should apply filters to stripped paths", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1.0",
				operationFilters: {
					includePaths: ["/users", "/users/*"], // Filter on stripped path
				},
				useOperationId: true,
			});

			const clientCode = generator.generateClientString();

			// Should include user endpoints
			expect(clientCode).toContain("async getUsers(");
			expect(clientCode).toContain("async getUserById(");

			// Should exclude posts endpoint
			expect(clientCode).not.toContain("async getPosts(");
		});

		it("should exclude paths based on stripped paths", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1.0",
				operationFilters: {
					excludePaths: ["/posts"],
				},
			});

			const clientCode = generator.generateClientString();

			// Should include user endpoints
			expect(clientCode).toContain("async getUsers(");

			// Should exclude posts
			expect(clientCode).not.toContain("async getPosts(");
		});
	});

	describe("service generation with stripPathPrefix", () => {
		it("should generate service methods with stripped paths", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				outputService: "service.ts",
				stripPathPrefix: "/api/v1.0",
				useOperationId: true,
			});

			const serviceCode = generator.generateServiceString();

			// Service method names should use operationId
			expect(serviceCode).toContain("async getUsers(");
			expect(serviceCode).toContain("async createUser(");
			expect(serviceCode).toContain("async getUserById(");

			// JSDoc should show stripped paths
			expect(serviceCode).toContain("GET /users");
			expect(serviceCode).toContain("POST /users");
		});
	});

	describe("edge cases", () => {
		it("should handle empty string prefix (no stripping)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "",
			});

			const clientCode = generator.generateClientString();

			// Should keep original paths
			expect(clientCode).toContain("GET /api/v1.0/users");
		});

		it("should handle undefined prefix (no stripping)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: undefined,
			});

			const clientCode = generator.generateClientString();

			// Should keep original paths
			expect(clientCode).toContain("GET /api/v1.0/users");
		});

		it("should handle path that becomes empty after stripping", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1",
			});

			const clientCode = generator.generateClientString();

			// Should become root path
			expect(clientCode).toContain("GET /");
		});

		it("should handle path params in stripped paths", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1.0",
				useOperationId: true,
			});

			const clientCode = generator.generateClientString();

			// Should preserve path parameters
			expect(clientCode).toContain("async getUserById(id: string");
			expect(clientCode).toContain("GET /users/{id}");
			expect(clientCode).toMatch(/request\.get\(`\/users\/\$\{id\}`/);
		});

		it("should handle invalid glob pattern gracefully", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v[", // Invalid glob - unclosed bracket
			});

			// Should not throw, but log warning
			const clientCode = generator.generateClientString();

			// Should keep original paths when glob is invalid
			expect(clientCode).toContain("GET /api/v1.0/users");
		});
	});

	describe("method name generation with stripped paths", () => {
		it("should generate cleaner method names from stripped paths", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1.0",
				useOperationId: false, // Use generated names
			});

			const clientCode = generator.generateClientString();

			// Method names should be cleaner without prefix
			expect(clientCode).toContain("async getUsers(");
			expect(clientCode).toContain("async postUsers(");
			expect(clientCode).toContain("async getUsersById(");
			expect(clientCode).toContain("async getPosts(");
		});

		it("should respect useOperationId when present", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1.0",
				useOperationId: true,
			});

			const clientCode = generator.generateClientString();

			// Should use operationId regardless of stripping
			expect(clientCode).toContain("async getUsers(");
			expect(clientCode).toContain("async createUser(");
			expect(clientCode).toContain("async getUserById(");
		});
	});

	describe("multiple paths with similar prefixes", () => {
		it("should only strip the exact matching prefix", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: "output.ts",
				outputClient: "client.ts",
				stripPathPrefix: "/api/v1.0",
			});

			const clientCode = generator.generateClientString();

			// Only v1.0 should be stripped
			expect(clientCode).toContain("GET /api/v1/users");
			expect(clientCode).toContain("GET /users"); // v1.0 stripped
			expect(clientCode).toContain("GET /api/v10/users");
		});
	});
});
