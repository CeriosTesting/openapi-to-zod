import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("BasePath Option", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	describe("Path normalization", () => {
		it("should not modify paths when basePath is undefined", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const output = generator.generateClientString();

			// Should contain original paths without modification
			expect(output).toContain("GET /users");
			expect(output).toContain("GET /users/{userId}");
			expect(output).toContain("POST /users");
			expect(output).toContain("await this.request.get(`/users`");
			expect(output).toContain("await this.request.get(`/users/${userId}`");
		});

		it("should normalize empty string to undefined (no basePath)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "",
			});

			const output = generator.generateClientString();

			// Should behave exactly like undefined - no basePath prepended
			expect(output).toContain("GET /users");
			expect(output).toContain("await this.request.get(`/users`");
			expect(output).not.toContain("/api");
		});

		it("should normalize single slash to undefined (no basePath)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/",
			});

			const output = generator.generateClientString();

			// Should behave exactly like undefined - no basePath prepended
			expect(output).toContain("GET /users");
			expect(output).toContain("await this.request.get(`/users`");
			expect(output).not.toContain("//users"); // No double slashes in paths
		});

		it("should normalize basePath with leading slash", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api/v1",
			});

			const output = generator.generateClientString();

			// Should prepend basePath to all endpoints
			expect(output).toContain("GET /api/v1/users");
			expect(output).toContain("GET /api/v1/users/{userId}");
			expect(output).toContain("POST /api/v1/users");
			expect(output).toContain("await this.request.get(`/api/v1/users`");
			expect(output).toContain("await this.request.get(`/api/v1/users/${userId}`");
		});

		it("should normalize basePath without leading slash", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "api/v1",
			});

			const output = generator.generateClientString();

			// Should add leading slash and prepend
			expect(output).toContain("GET /api/v1/users");
			expect(output).toContain("await this.request.get(`/api/v1/users`");
		});

		it("should normalize basePath with trailing slash", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api/v1/",
			});

			const output = generator.generateClientString();

			// Should remove trailing slash
			expect(output).toContain("GET /api/v1/users");
			expect(output).toContain("await this.request.get(`/api/v1/users`");
			expect(output).not.toContain("/api/v1//"); // No double slashes
		});

		it("should normalize basePath without leading slash but with trailing slash", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "api/v1/",
			});

			const output = generator.generateClientString();

			// Should add leading slash and remove trailing slash
			expect(output).toContain("GET /api/v1/users");
			expect(output).toContain("await this.request.get(`/api/v1/users`");
		});

		it("should handle basePath with whitespace", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "  /api/v1  ",
			});

			const output = generator.generateClientString();

			// Should trim whitespace
			expect(output).toContain("GET /api/v1/users");
			expect(output).toContain("await this.request.get(`/api/v1/users`");
		});

		it("should normalize basePath with only whitespace to undefined", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "   ",
			});

			const output = generator.generateClientString();

			// Should behave like undefined
			expect(output).toContain("GET /users");
			expect(output).toContain("await this.request.get(`/users`");
		});
	});

	describe("Path construction", () => {
		it("should preserve path parameters in URLs", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api/v1",
			});

			const output = generator.generateClientString();

			// Path parameters should be interpolated correctly
			expect(output).toContain("await this.request.get(`/api/v1/users/${userId}`");
			expect(output).toContain("async getUsersByUserId(userId: string");
		});

		it("should handle multiple path segments in basePath", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api/v2/internal",
			});

			const output = generator.generateClientString();

			expect(output).toContain("GET /api/v2/internal/users");
			expect(output).toContain("await this.request.get(`/api/v2/internal/users`");
		});

		it("should handle root endpoint with basePath", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api",
			});

			const output = generator.generateClientString();

			// All endpoints should be prefixed
			expect(output).toContain("/api/users");
			expect(output).not.toContain("GET /users\n"); // No unprefixed paths in JSDoc
		});
	});

	describe("JSDoc comments", () => {
		it("should show full path including basePath in client JSDoc", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api/v1",
			});

			const output = generator.generateClientString();

			// JSDoc should show complete path (may be after summary/description)
			expect(output).toContain("GET /api/v1/users");
			expect(output).toContain("POST /api/v1/users");
			expect(output).toContain("GET /api/v1/users/{userId}");
		});
		it("should show original path in JSDoc when no basePath", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const output = generator.generateClientString();

			// JSDoc should show original paths (may be after summary/description)
			expect(output).toContain("GET /users");
			expect(output).toContain("POST /users");
		});
	});

	describe("Split files with basePath", () => {
		it("should apply basePath in separate client file", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: TestUtils.getOutputPath("base-path-schemas.ts"),
				outputClient: TestUtils.getOutputPath("base-path-client.ts"),
				basePath: "/api/v1",
			});

			generator.generate();

			const clientContent = readFileSync(TestUtils.getOutputPath("base-path-client.ts"), "utf-8");

			// Client should have basePath in all methods
			expect(clientContent).toContain("GET /api/v1/users");
			expect(clientContent).toContain("await this.request.get(`/api/v1/users`");
		});

		it("should apply basePath in separate service file", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: TestUtils.getOutputPath("base-path-schemas2.ts"),
				outputClient: TestUtils.getOutputPath("base-path-client2.ts"),
				outputService: TestUtils.getOutputPath("base-path-service2.ts"),
				basePath: "/api/v2",
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("base-path-service2.ts"), "utf-8");

			// Service delegates to client which has basePath
			// Service should just call client methods normally
			expect(serviceContent).toContain("await this._client.getUsers");
			expect(serviceContent).toContain("await this._client.getUsersByUserId");
		});
	});

	describe("Different HTTP methods", () => {
		it("should apply basePath to all HTTP methods", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api",
			});

			const output = generator.generateClientString();

			// Check various HTTP methods
			expect(output).toContain("GET /api/users");
			expect(output).toContain("POST /api/users");
			expect(output).toContain("await this.request.get(`/api/users`");
			expect(output).toContain("await this.request.post(`/api/users`");
		});
	});

	describe("API versioning use case", () => {
		it("should support v1 API path", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api/v1",
			});

			const output = generator.generateClientString();

			expect(output).toContain("GET /api/v1/users");
			expect(output).toContain("await this.request.get(`/api/v1/users`");
		});

		it("should support v2 API path", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/v2",
			});

			const output = generator.generateClientString();

			expect(output).toContain("GET /v2/users");
			expect(output).toContain("await this.request.get(`/v2/users`");
		});

		it("should support nested versioned paths", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/services/users/v3",
			});

			const output = generator.generateClientString();

			expect(output).toContain("GET /services/users/v3/users");
			expect(output).toContain("await this.request.get(`/services/users/v3/users`");
		});
	});

	describe("Edge cases", () => {
		it("should handle endpoint path without leading slash", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api",
			});

			const output = generator.generateClientString();

			// Even if OpenAPI spec has paths without leading slash, should handle gracefully
			expect(output).toContain("/api/users");
		});

		it("should not create double slashes", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api/v1/",
			});

			const output = generator.generateClientString();

			// Should never have double slashes
			expect(output).not.toContain("//users");
			expect(output).not.toContain("/api/v1//");
		});

		it("should handle complex basePath with special characters", () => {
			const generator = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api-gateway/v1.0",
			});

			const output = generator.generateClientString();

			expect(output).toContain("GET /api-gateway/v1.0/users");
			expect(output).toContain("await this.request.get(`/api-gateway/v1.0/users`");
		});
	});

	describe("Schema generation (basePath should not affect)", () => {
		it("should not affect schema generation", () => {
			const generatorWithoutBasePath = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const generatorWithBasePath = new OpenApiPlaywrightGenerator({
				useOperationId: false,
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				basePath: "/api/v1",
			});

			const outputWithout = generatorWithoutBasePath.generateSchemasString();
			const outputWith = generatorWithBasePath.generateSchemasString();

			// Schemas should be identical regardless of basePath (except timestamp)
			// Remove timestamps before comparing
			const withoutTimestamp = outputWithout.replace(/Generated at: .*/, "");
			const withTimestamp = outputWith.replace(/Generated at: .*/, "");
			expect(withTimestamp).toBe(withoutTimestamp);
		});
	});
});
