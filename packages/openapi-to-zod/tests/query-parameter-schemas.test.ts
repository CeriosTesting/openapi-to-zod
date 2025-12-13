import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";

describe("Query Parameter Schema Generation", () => {
	const fixtureInput = resolve(__dirname, "fixtures/query-parameters.yaml");

	it("should generate query parameter schemas for operations with query params", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should contain schema for /users endpoint (searchUsers operation)
		expect(output).toContain("SearchUsersQueryParams");
		expect(output).toContain("export const searchUsersQueryParamsSchema");
		expect(output).toContain("export type SearchUsersQueryParams");

		// Should contain schema for /products endpoint
		expect(output).toContain("ListProductsQueryParams");
		expect(output).toContain("export const listProductsQueryParamsSchema");

		// Should contain schema for /orders endpoint
		expect(output).toContain("GetOrdersQueryParams");
		expect(output).toContain("export const getOrdersQueryParamsSchema");

		// Should NOT contain schema for /config endpoint (no query params)
		expect(output).not.toContain("GetConfigQueryParams");
	});

	it("should generate correct types for query parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Check /users endpoint parameters
		expect(output).toContain("page: z.number().int().gte(1).optional()");
		expect(output).toContain("limit: z.number().int().gte(1).lte(100).optional()");
		expect(output).toContain("search: z.string().optional()");
		expect(output).toContain('sort: z.enum(["name", "createdAt", "updatedAt"]).optional()');
		expect(output).toContain("active: z.boolean().optional()");
		expect(output).toContain("tags: z.array(z.string()).optional()");
	});

	it("should handle required query parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Check /products endpoint - status is required
		expect(output).toContain('status: z.enum(["available", "discontinued", "out_of_stock"])');
		// Should NOT have .optional() on required params
		const statusMatch = output.match(/status: z\.enum\(\[.*?\]\)(?!\.optional\(\))/);
		expect(statusMatch).toBeTruthy();
	});

	it("should handle array parameters with different serialization styles", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// /products - ids with form style (comma-separated)
		expect(output).toContain("ids: z.array(z.number().int()).optional()");

		// /products - categories with spaceDelimited
		expect(output).toContain("categories: z.array(z.string()).optional()");

		// /orders - statuses with pipeDelimited
		expect(output).toContain("statuses: z.array(z.string()).optional()");
	});

	it("should handle number constraints in query parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// /orders - minAmount and maxAmount with constraints
		expect(output).toContain("minAmount: z.number().gte(0).optional()");
		expect(output).toContain("maxAmount: z.number().lte(10000).optional()");
	});

	it("should generate schemas with correct JSDoc comments", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
			includeDescriptions: true,
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should contain JSDoc with operation name
		expect(output).toContain("/**\n * Query parameters for searchUsers\n */");
		expect(output).toContain("/**\n * Query parameters for listProducts\n */");
		expect(output).toContain("/**\n * Query parameters for getOrders\n */");
	});

	it("should respect strict mode for query parameter objects", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "strict",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should use z.strictObject() instead of z.object()
		expect(output).toContain("z.strictObject({");
	});

	it("should respect loose mode for query parameter objects", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "loose",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should use z.looseObject() instead of z.object()
		expect(output).toContain("z.looseObject({");
	});

	it("should work with prefix and suffix options", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
			prefix: "api",
			suffix: "dto",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should apply prefix and suffix to schema names
		expect(output).toContain("export const apiSearchUsersDtoQueryParamsSchema");
		expect(output).toContain("export type SearchUsersQueryParams");
	});

	it("should handle useDescribe option for parameter descriptions", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
			useDescribe: true,
			includeDescriptions: true,
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should add .describe() calls for parameters with descriptions
		expect(output).toContain('.describe("Page number for pagination")');
		expect(output).toContain('.describe("Number of items per page")');
		expect(output).toContain('.describe("Search term to filter users")');
	});

	it("should handle operations without query parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// /config has no query parameters, should not generate schema
		expect(output).not.toContain("GetConfigQueryParams");
		expect(output).not.toContain("getConfigQueryParamsSchema");
	});

	it("should handle operations without operationId gracefully", () => {
		// This test uses a fixture where some operations may not have operationId
		// The generator should skip those operations
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);

		// Should not throw error
		expect(() => generator.generateString()).not.toThrow();
	});

	it("should generate valid TypeScript/Zod code", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Basic validation that output contains valid Zod imports and schemas
		expect(output).toContain('import { z } from "zod"');
		expect(output).toContain("export const");
		expect(output).toContain("export type");
		expect(output).toMatch(/z\.(object|strictObject|looseObject)\(/);
	});
});
