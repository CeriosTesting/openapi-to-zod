import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("Query Parameter Schema Types in Service", () => {
	const fixtureFile = TestUtils.getFixturePath("query-params-api.yaml");

	describe("with useOperationId: true", () => {
		it("should use typed query params from operationId in service methods", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// Service should use the typed query parameter schema name based on operationId
			expect(serviceOutput).toContain("params?: SearchUsersQueryParams");
			// Should NOT use generic QueryParams type
			expect(serviceOutput).not.toContain("params?: QueryParams");
		});

		it("should use the operationId-based type name for query params", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// Method should be named based on operationId (searchUsers)
			// Query param type should be based on operationId (SearchUsersQueryParams)
			expect(serviceOutput).toContain("SearchUsersQueryParams");
		});
	});

	describe("with useOperationId: false (path-based method naming)", () => {
		it("should use path-based query params when useOperationId is false", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				useOperationId: false,
			});

			const serviceOutput = generator.generateServiceString();

			// When useOperationId is false, both method names AND type names use path-based naming
			// Method: getUsers (from GET /users), Type: GetUsersQueryParams (from path)
			expect(serviceOutput).toContain("params?: GetUsersQueryParams");
			// Should NOT use generic QueryParams type
			expect(serviceOutput).not.toContain("params?: QueryParams");
		});

		it("should use path-based type name when useOperationId is false", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				useOperationId: false,
			});

			const serviceOutput = generator.generateServiceString();

			// Schema type name should be based on path (to match types file output)
			expect(serviceOutput).toContain("GetUsersQueryParams");
		});
	});
});

describe("Query Parameter Schema Types Without OperationId", () => {
	const fixtureFile = TestUtils.getFixturePath("no-operationid-api.yaml");

	it("should generate typed query params using path+method when no operationId exists", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
			useOperationId: false,
		});

		const serviceOutput = generator.generateServiceString();

		// All operations in this fixture have no operationId
		// GET /users -> getUsers method with GetUsersQueryParams
		// Should NOT use generic QueryParams
		expect(serviceOutput).not.toContain("params?: QueryParams");
	});

	it("should generate path-based query param types for GET /users", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
			useOperationId: false,
		});

		const serviceOutput = generator.generateServiceString();

		// GET /users should have GetUsersQueryParams
		expect(serviceOutput).toContain("GetUsersQueryParams");
	});

	it("should generate path-based query param types for GET /products/{productId}", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
			useOperationId: false,
		});

		const serviceOutput = generator.generateServiceString();

		// GET /products/{productId} should have GetProductsByProductIdQueryParams
		expect(serviceOutput).toContain("GetProductsByProductIdQueryParams");
	});

	it("should generate path-based query param types for GET /orders", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
			useOperationId: false,
		});

		const serviceOutput = generator.generateServiceString();

		// GET /orders should have GetOrdersQueryParams
		expect(serviceOutput).toContain("GetOrdersQueryParams");
	});

	it("should work with useOperationId: true when operationId is missing", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
			useOperationId: true, // Even with true, missing operationId uses path-based
		});

		const serviceOutput = generator.generateServiceString();

		// Should still use typed params (path-based) because operationId doesn't exist
		expect(serviceOutput).not.toContain("params?: QueryParams");
		// Should use path-based naming
		expect(serviceOutput).toContain("GetUsersQueryParams");
	});

	it("should NOT generate query param type for endpoint without query params", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
			useOperationId: false,
		});

		const serviceOutput = generator.generateServiceString();

		// GET /config has no query params, should not have any param option
		// The method getConfig should exist but not have query params
		if (serviceOutput.includes("getConfig")) {
			expect(serviceOutput).not.toContain("GetConfigQueryParams");
		}
	});
});

describe("Header Parameter Schema Types in Service", () => {
	const fixtureFile = TestUtils.getFixturePath("query-params-api.yaml");

	describe("with useOperationId: false (path-based naming)", () => {
		it("should use typed header params when available", () => {
			// This test verifies that header params also get proper type names
			// when useOperationId is false
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				useOperationId: false,
			});

			const serviceOutput = generator.generateServiceString();

			// If the fixture has header params, they should use typed schema
			// Should NOT use generic HttpHeaders type
			if (serviceOutput.includes("headers?:")) {
				expect(serviceOutput).not.toMatch(/headers\?: HttpHeaders(?!\w)/);
			}
		});
	});
});
