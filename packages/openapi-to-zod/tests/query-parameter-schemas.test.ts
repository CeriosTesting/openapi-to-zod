import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";

describe("Query Parameter Schema Generation", () => {
	const fixtureInput = resolve(__dirname, "fixtures/query-parameters.yaml");

	it("should generate query parameter schemas for operations with query params", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
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
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);

		// Should not throw error
		expect(() => generator.generateString()).not.toThrow();
	});

	it("should generate valid TypeScript/Zod code", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			outputTypes: "output.ts",
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

	it("should use method+path naming when useOperationId is false", () => {
		const options: OpenApiGeneratorOptions = {
			input: fixtureInput,
			outputTypes: "output.ts",
			mode: "normal",
			useOperationId: false,
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		expect(output).toContain("GetUsersQueryParams");
		expect(output).toContain("export const getUsersQueryParamsSchema");
		expect(output).toContain("GetProductsQueryParams");
		expect(output).toContain("export const getProductsQueryParamsSchema");
		expect(output).toContain("GetOrdersQueryParams");
		expect(output).toContain("export const getOrdersQueryParamsSchema");

		expect(output).not.toContain("SearchUsersQueryParams");
		expect(output).not.toContain("ListProductsQueryParams");
	});
});

describe("Query Parameter Schema Generation Without OperationId", () => {
	const noOperationIdFixture = resolve(__dirname, "fixtures/query-params-no-operationid.yaml");

	it("should generate query param schemas using path+method naming when no operationId", () => {
		const options: OpenApiGeneratorOptions = {
			input: noOperationIdFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should generate schema for GET /users -> GetUsersQueryParams
		expect(output).toContain("GetUsersQueryParams");
		expect(output).toContain("export const getUsersQueryParamsSchema");

		// Should generate schema for GET /users/{userId} -> GetUsersByUserIdQueryParams
		expect(output).toContain("GetUsersByUserIdQueryParams");
		expect(output).toContain("export const getUsersByUserIdQueryParamsSchema");

		// Should generate schema for GET /organizations/{orgId}/members -> GetOrganizationsByOrgIdMembersQueryParams
		expect(output).toContain("GetOrganizationsByOrgIdMembersQueryParams");
		expect(output).toContain("export const getOrganizationsByOrgIdMembersQueryParamsSchema");

		// Should generate schema for POST /search -> PostSearchQueryParams
		expect(output).toContain("PostSearchQueryParams");
		expect(output).toContain("export const postSearchQueryParamsSchema");
	});

	it("should NOT generate query param schema when no query params exist", () => {
		const options: OpenApiGeneratorOptions = {
			input: noOperationIdFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// GET /config has no query params, should not generate schema
		expect(output).not.toContain("GetConfigQueryParams");
		expect(output).not.toContain("getConfigQueryParamsSchema");
	});

	it("should generate header param schemas using path+method naming when no operationId", () => {
		const options: OpenApiGeneratorOptions = {
			input: noOperationIdFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should generate schema for GET /headers -> GetHeadersHeaderParams
		expect(output).toContain("GetHeadersHeaderParams");
	});

	it("should generate correct types for query params without operationId", () => {
		const options: OpenApiGeneratorOptions = {
			input: noOperationIdFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Check GET /users parameters
		expect(output).toContain("page: z.number().int().gte(1).optional()");
		expect(output).toContain("limit: z.number().int().gte(1).lte(100).optional()");
		expect(output).toContain("search: z.string().optional()");

		// Check required param in GET /organizations/{orgId}/members
		expect(output).toContain("active: z.boolean()");
		// Role should be an enum
		expect(output).toContain('role: z.enum(["admin", "member", "viewer"]).optional()');
	});

	it("should handle path params correctly when generating query param schema names", () => {
		const options: OpenApiGeneratorOptions = {
			input: noOperationIdFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Path: /users/{userId} should generate GetUsersByUserIdQueryParams
		// The "ByUserId" part comes from the path parameter
		expect(output).toContain("GetUsersByUserIdQueryParams");

		// Path: /organizations/{orgId}/members should generate GetOrganizationsByOrgIdMembersQueryParams
		expect(output).toContain("GetOrganizationsByOrgIdMembersQueryParams");
	});

	it("should work with useDescribe option for operations without operationId", () => {
		const options: OpenApiGeneratorOptions = {
			input: noOperationIdFixture,
			outputTypes: "output.ts",
			mode: "normal",
			useDescribe: true,
			includeDescriptions: true,
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should add .describe() calls for parameters with descriptions
		expect(output).toContain('.describe("Page number for pagination")');
		expect(output).toContain('.describe("Number of items per page")');
	});
});

describe("Query Parameter Schema Generation with stripPathPrefix", () => {
	const stripPathPrefixFixture = resolve(__dirname, "fixtures/strip-path-prefix-query-params.yaml");

	it("should strip path prefix when generating query param schema names", () => {
		const options: OpenApiGeneratorOptions = {
			input: stripPathPrefixFixture,
			outputTypes: "output.ts",
			mode: "normal",
			stripPathPrefix: "/api/v1",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Without stripPathPrefix, would be GetApiV1UsersQueryParams
		// With stripPathPrefix: "/api/v1", should be GetUsersQueryParams
		expect(output).toContain("getSearchQueryParamsSchema");
		expect(output).toContain("GetUsersQueryParams");

		// Should NOT contain the full path version
		expect(output).not.toContain("GetApiV1UsersQueryParams");
		expect(output).not.toContain("getApiV1UsersQueryParamsSchema");
	});

	it("should handle path params correctly with stripPathPrefix", () => {
		const options: OpenApiGeneratorOptions = {
			input: stripPathPrefixFixture,
			outputTypes: "output.ts",
			mode: "normal",
			stripPathPrefix: "/api/v1",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Path: /api/v1/users/{userId}/posts should become /users/{userId}/posts
		// Which generates GetUsersByUserIdPostsQueryParams
		expect(output).toContain("GetUsersByUserIdPostsQueryParams");
		expect(output).not.toContain("GetApiV1UsersByUserIdPostsQueryParams");
	});

	it("should support glob patterns in stripPathPrefix", () => {
		const options: OpenApiGeneratorOptions = {
			input: stripPathPrefixFixture,
			outputTypes: "output.ts",
			mode: "normal",
			stripPathPrefix: "/api/v*",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// With glob pattern, should still strip the prefix
		expect(output).toContain("GetUsersQueryParams");
		expect(output).not.toContain("GetApiV1UsersQueryParams");
	});

	it("should generate typed schema imports", () => {
		const options: OpenApiGeneratorOptions = {
			input: stripPathPrefixFixture,
			outputTypes: "output.ts",
			mode: "normal",
			stripPathPrefix: "/api/v1",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should generate both schema and type
		expect(output).toContain("getSearchQueryParamsSchema");
		expect(output).toContain("type GetSearchQueryParams = z.infer<typeof getSearchQueryParamsSchema>");
	});
});

describe("Component Parameter $ref Resolution", () => {
	const componentParamsFixture = resolve(__dirname, "fixtures/component-parameters.yaml");

	it("should resolve $ref to component parameters for query params", () => {
		const options: OpenApiGeneratorOptions = {
			input: componentParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should generate schema for listItems which has both inline and $ref params
		expect(output).toContain("ListItemsQueryParams");
		expect(output).toContain("listItemsQueryParamsSchema");

		// Should include the resolved parameter names from components.parameters
		expect(output).toContain('"page[number]"');
		expect(output).toContain('"page[size]"');
		expect(output).toContain("sort");
		expect(output).toContain("search");
	});

	it("should handle operations with only $ref parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: componentParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// getUsers has only $ref parameters (PageNumber, PageSize as query, ApiKey as header)
		expect(output).toContain("GetUsersQueryParams");
		expect(output).toContain("getUsersQueryParamsSchema");

		// Should resolve the parameter names correctly
		expect(output).toContain('"page[number]"');
		expect(output).toContain('"page[size]"');
	});

	it("should apply constraints from component parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: componentParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// PageNumber has minimum: 1, PageSize has minimum: 1 and maximum: 100
		expect(output).toContain(".gte(1)");
		expect(output).toContain(".lte(100)");
	});

	it("should handle enum values from component parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: componentParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// SortOrder parameter has enum: [asc, desc]
		expect(output).toContain('z.enum(["asc", "desc"])');
	});

	it("should include descriptions from component parameters when useDescribe is enabled", () => {
		const options: OpenApiGeneratorOptions = {
			input: componentParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
			useDescribe: true,
			includeDescriptions: true,
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Should include descriptions from component parameters
		expect(output).toContain('.describe("The page number to retrieve for paginated results")');
		expect(output).toContain('.describe("The number of items per page")');
	});

	it("should resolve header parameter $refs correctly", () => {
		const options: OpenApiGeneratorOptions = {
			input: componentParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// getUsers has ApiKey header param via $ref
		expect(output).toContain("GetUsersHeaderParams");
		expect(output).toContain("getUsersHeaderParamsSchema");
		expect(output).toContain('"X-API-Key"');
	});

	it("should not generate query param schema when only header $refs exist", () => {
		const options: OpenApiGeneratorOptions = {
			input: componentParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// getNoParams has no parameters
		expect(output).not.toContain("GetNoParamsQueryParams");
	});

	it("should handle mixed inline and $ref parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: componentParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// getProducts has inline 'category' and 'filter[active]' plus $ref params
		expect(output).toContain("GetProductsQueryParams");
		expect(output).toContain("category");
		expect(output).toContain('"filter[active]"');
		expect(output).toContain('"page[number]"');
		expect(output).toContain('"page[size]"');
	});
});

describe("Path-Level Parameter Support", () => {
	const pathLevelParamsFixture = resolve(__dirname, "fixtures/path-level-parameters.yaml");

	it("should include path-level query parameters in operation schemas", () => {
		const options: OpenApiGeneratorOptions = {
			input: pathLevelParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// listItems only has path-level params (PageNumber, PageSize)
		expect(output).toContain("ListItemsQueryParams");
		expect(output).toContain("listItemsQueryParamsSchema");
		expect(output).toContain('"page[number]"');
		expect(output).toContain('"page[size]"');
	});

	it("should merge path-level and operation-level query parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: pathLevelParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// getOrgMembers has path-level params (PageNumber, PageSize) + operation-level (role)
		expect(output).toContain("GetOrgMembersQueryParams");
		expect(output).toContain('"page[number]"');
		expect(output).toContain('"page[size]"');
		expect(output).toContain("role");
		expect(output).toContain('z.enum(["admin", "member", "viewer"])');
	});

	it("should include path-level header parameters in operation schemas", () => {
		const options: OpenApiGeneratorOptions = {
			input: pathLevelParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// getUser has path-level header param (ApiVersion)
		expect(output).toContain("GetUserHeaderParams");
		expect(output).toContain("getUserHeaderParamsSchema");
		expect(output).toContain('"X-API-Version"');
	});

	it("should merge operation-level params with path-level params from $ref", () => {
		const options: OpenApiGeneratorOptions = {
			input: pathLevelParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// getUser has: path-level header (ApiVersion $ref) + operation-level query (include)
		expect(output).toContain("GetUserQueryParams");
		expect(output).toContain("include");
		expect(output).toContain('z.enum(["profile", "settings", "preferences"])');
	});

	it("should generate schemas for operations with only path-level params", () => {
		const options: OpenApiGeneratorOptions = {
			input: pathLevelParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// updateUser has no operation-level params but inherits path-level header (ApiVersion)
		expect(output).toContain("UpdateUserHeaderParams");
		expect(output).toContain('"X-API-Version"');
	});

	it("should handle nested $ref resolution in path-level parameters", () => {
		const options: OpenApiGeneratorOptions = {
			input: pathLevelParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Path-level params use $ref (ApiVersion, PageNumber, PageSize)
		// Should resolve correctly
		expect(output).toContain("z.number().int().gte(1)");
		expect(output).toContain("z.number().int().gte(1).lte(100)");
	});

	it("should preserve constraints from path-level component parameter $refs", () => {
		const options: OpenApiGeneratorOptions = {
			input: pathLevelParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// PageSize has minimum: 1 and maximum: 100
		expect(output).toContain(".gte(1).lte(100)");
	});

	it("should include descriptions from path-level parameters when useDescribe is enabled", () => {
		const options: OpenApiGeneratorOptions = {
			input: pathLevelParamsFixture,
			outputTypes: "output.ts",
			mode: "normal",
			useDescribe: true,
			includeDescriptions: true,
		};

		const generator = new OpenApiGenerator(options);
		const output = generator.generateString();

		// Path-level params have descriptions that should be included
		expect(output).toContain('.describe("Page number for pagination")');
		expect(output).toContain('.describe("Number of items per page")');
	});
});
