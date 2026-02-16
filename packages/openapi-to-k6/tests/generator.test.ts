import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { OpenApiK6Generator } from "../src/openapi-k6-generator";

describe("OpenApiK6Generator", () => {
	const fixtureFile = resolve(__dirname, "fixtures/simple-api.yaml");
	const contentTypesFixtureFile = resolve(__dirname, "fixtures/content-types-api.yaml");

	describe("constructor", () => {
		it("should create generator with valid options", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			expect(generator).toBeDefined();
		});

		it("should throw error when input file not found", () => {
			expect(() => {
				new OpenApiK6Generator({
					input: "non-existent.yaml",
					outputClient: "test-client.ts",
					outputTypes: "test-types.ts",
				});
			}).toThrow("Input file not found");
		});

		it("should throw error when output not specified", () => {
			expect(() => {
				new OpenApiK6Generator({
					input: fixtureFile,
					outputClient: "",
					outputTypes: "test-types.ts",
				});
			}).toThrow("Output client path is required");
		});

		it("should throw error when outputTypes not specified", () => {
			expect(() => {
				new OpenApiK6Generator({
					input: fixtureFile,
					outputClient: "test-client.ts",
					outputTypes: "",
				});
			}).toThrow("Output types path is required");
		});
	});

	describe("generateString", () => {
		it("should generate K6 client code", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			expect(output).toContain("import http from");
			expect(output).toContain("export class");
			expect(output).toContain("baseUrl: string");
			expect(output).toContain("commonRequestParameters: Params");
		});

		it("should generate methods for each endpoint", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			// Should have methods for users endpoints
			expect(output).toContain("getUsers(");
			expect(output).toContain("postUsers(");
			expect(output).toContain("getUsersByUserId(");
			expect(output).toContain("putUsersByUserId(");
			expect(output).toContain("deleteUsersByUserId(");
		});

		it("should use operationId for method names when enabled", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			expect(output).toContain("listUsers(");
			expect(output).toContain("createUser(");
			expect(output).toContain("getUserById(");
			expect(output).toContain("updateUser(");
			expect(output).toContain("deleteUser(");
		});

		it("should include path parameters in method signature", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			expect(output).toContain("getUserById(userId: string");
		});

		it("should generate query params type", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const typesOutput = generator.generateParamTypesString();

			expect(typesOutput).toContain("export type ListUsersParams = {");
			expect(typesOutput).toContain("page?: number");
			expect(typesOutput).toContain("limit?: number");
		});

		it("should generate header params type", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const typesOutput = generator.generateParamTypesString();

			expect(typesOutput).toContain("export type ListUsersHeaders = {");
			expect(typesOutput).toContain('"X-Request-ID"');
		});

		it("should only include body in options when endpoint has request body", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// POST/PUT methods should have body in options
			expect(output).toContain("body?: RequestBody | null");
			// All methods should have requestParameters
			expect(output).toContain("requestParameters?: Params");
		});

		it("should only include params in options when endpoint has query params", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// Endpoints with query params should have params?: QueryParams
			expect(output).toContain("params?: QueryParams");
			// getUserById should only have requestParameters (no params, no body)
			expect(output).toMatch(/getUserById\(userId: string, options\?: \{\s*requestParameters\?: Params;\s*\}\)/);
		});
	});

	describe("helper methods", () => {
		it("should use operationId for operation-derived schema types when enabled", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateSchemaTypesString();

			expect(output).toContain("export type ListUsersQueryParams");
			expect(output).toContain("export type ListUsersHeaderParams");
		});

		it("should use method+path naming for operation-derived schema types when useOperationId is false", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: false,
			});

			const output = generator.generateSchemaTypesString();

			expect(output).toContain("export type GetUsersQueryParams");
			expect(output).toContain("export type GetUsersHeaderParams");
			expect(output).not.toContain("export type ListUsersQueryParams");
		});

		it("should import mergeRequestParameters from runtime", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			expect(output).toContain('from "@cerios/openapi-to-k6"');
			expect(output).toContain("mergeRequestParameters");
		});

		it("should import buildQueryString from runtime when needed", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			// Fixture has endpoints with query params, so buildQueryString should be imported
			expect(output).toContain("buildQueryString");
			expect(output).toContain("buildQueryString(options?.params)");
		});

		it("should use cleanBaseUrl in constructor", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			expect(output).toContain("this.baseUrl = cleanBaseUrl(baseUrl)");
		});
	});

	describe("filtering", () => {
		it("should filter by tags", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
				operationFilters: {
					includeTags: ["auth"],
				},
			});

			const output = generator.generateString();

			expect(output).toContain("login(");
			expect(output).not.toContain("listUsers(");
			expect(output).not.toContain("getUserById(");
		});

		it("should filter by methods", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				operationFilters: {
					includeMethods: ["get"],
				},
			});

			const output = generator.generateString();

			expect(output).toContain("getUsers(");
			expect(output).not.toContain("postUsers(");
			expect(output).not.toContain("deleteUsersByUserId(");
		});

		it("should exclude deprecated operations", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
				operationFilters: {
					excludeDeprecated: true,
				},
			});

			const output = generator.generateString();

			expect(output).not.toContain("deleteUser(");
			expect(output).toContain("listUsers(");
		});

		it("should ignore specified headers", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
				ignoreHeaders: ["X-*"],
			});

			const output = generator.generateString();

			expect(output).not.toContain('"X-Request-ID"');
		});
	});

	describe("basePath option", () => {
		it("should prepend basePath to all endpoints", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				basePath: "/api/v1",
			});

			const output = generator.generateString();

			expect(output).toContain("/api/v1/users");
			expect(output).toContain("/api/v1/auth/login");
		});
	});

	describe("JSDoc generation", () => {
		it("should include summary in JSDoc when enabled", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				includeDescriptions: true,
				useOperationId: true,
			});

			const output = generator.generateString();

			expect(output).toContain("@summary List all users");
		});

		it("should exclude descriptions when disabled", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				includeDescriptions: false,
				useOperationId: true,
			});

			const output = generator.generateString();

			expect(output).not.toContain("@summary");
			expect(output).not.toContain("@description");
		});

		it("should mark deprecated methods", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// Should have @deprecated for deleteUser
			expect(output).toContain("@deprecated");
		});
	});

	describe("property quoting", () => {
		it("should quote query param names with special characters", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const typesOutput = generator.generateParamTypesString();

			// Params with brackets should be quoted
			expect(typesOutput).toContain('"filter[id]"');
			expect(typesOutput).toContain('"filter[status]"');
			expect(typesOutput).toContain('"page[number]"');
			expect(typesOutput).toContain('"page[size]"');
		});

		it("should not quote valid identifier param names", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const typesOutput = generator.generateParamTypesString();

			// Regular param names should not be quoted
			expect(typesOutput).toMatch(/\bpage\?:/);
			expect(typesOutput).toMatch(/\blimit\?:/);
			expect(typesOutput).toMatch(/\brole\?:/);
		});

		it("should quote header names with dashes", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const typesOutput = generator.generateParamTypesString();

			// Header names with dashes should be quoted
			expect(typesOutput).toContain('"X-Request-ID"');
			expect(typesOutput).toContain('"X-Tenant-ID"');
		});
	});

	describe("separate types file", () => {
		it("should generate param types separately", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const typesOutput = generator.generateParamTypesString();

			expect(typesOutput).toContain("export type ListUsersParams = {");
			expect(typesOutput).toContain("export type ListUsersHeaders = {");
			expect(typesOutput).toContain("export type ListDossiersParams = {");
		});

		it("client should NOT import types from types file (pure K6 types only)", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateString();

			// Client should NOT import from generated types file - it uses pure K6 types
			expect(clientOutput).not.toContain('from "./types"');

			// Client should only import K6 types (may include RequestBody if endpoints have bodies)
			expect(clientOutput).toMatch(/import type \{[^}]*Params[^}]*\} from "k6\/http"/);
			expect(clientOutput).toMatch(/import type \{[^}]*Response[^}]*\} from "k6\/http"/);

			// Client should use requestParameters?: Params in options object
			expect(clientOutput).toContain("requestParameters?: Params");
		});
	});

	describe("Content-Type header", () => {
		it("should include Content-Type header for endpoints with JSON request body", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// POST/PUT methods with body should have Content-Type header
			expect(output).toContain('"Content-Type": "application/json"');
		});

		it("should NOT include Content-Type header for endpoints without request body", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// Extract just the listUsers method (GET without body)
			const listUsersMatch = output.match(
				/listUsers\([^)]*\)[^{]*\{[\s\S]*?return http\.request\("GET"[\s\S]*?\n {2}\}/
			);
			expect(listUsersMatch).toBeTruthy();

			const listUsersMethod = listUsersMatch?.[0] ?? "";
			// GET method should not have Content-Type in headers
			expect(listUsersMethod).not.toContain('"Content-Type"');
		});

		it("should allow user headers to override Content-Type", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// mergedParams?.headers should come after Content-Type to allow override
			expect(output).toMatch(/"Content-Type":[^,]+,\s*\.\.\.mergedParams\?\.headers/);
		});

		it("should use correct Content-Type for form-urlencoded endpoints", () => {
			const generator = new OpenApiK6Generator({
				input: contentTypesFixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// login method should have form-urlencoded Content-Type
			const loginMatch = output.match(/login\([^)]*\)[^{]*\{[\s\S]*?return http\.request\("POST"[\s\S]*?\n {2}\}/);
			expect(loginMatch).toBeTruthy();
			expect(loginMatch?.[0] ?? "").toContain('"Content-Type": "application/x-www-form-urlencoded"');
		});

		it("should use correct Content-Type for multipart/form-data endpoints", () => {
			const generator = new OpenApiK6Generator({
				input: contentTypesFixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// uploadFile method should have multipart/form-data Content-Type
			const uploadMatch = output.match(
				/uploadFile\([^)]*\)[^{]*\{[\s\S]*?return http\.request\("POST"[\s\S]*?\n {2}\}/
			);
			expect(uploadMatch).toBeTruthy();
			expect(uploadMatch?.[0] ?? "").toContain('"Content-Type": "multipart/form-data"');
		});

		it("should use correct Content-Type for JSON endpoints", () => {
			const generator = new OpenApiK6Generator({
				input: contentTypesFixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// createData method should have JSON Content-Type
			const createDataMatch = output.match(
				/createData\([^)]*\)[^{]*\{[\s\S]*?return http\.request\("POST"[\s\S]*?\n {2}\}/
			);
			expect(createDataMatch).toBeTruthy();
			expect(createDataMatch?.[0] ?? "").toContain('"Content-Type": "application/json"');
		});

		it("should NOT include Content-Type for GET endpoints", () => {
			const generator = new OpenApiK6Generator({
				input: contentTypesFixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				useOperationId: true,
			});

			const output = generator.generateString();

			// getStatus method should NOT have Content-Type
			const getStatusMatch = output.match(
				/getStatus\([^)]*\)[^{]*\{[\s\S]*?return http\.request\("GET"[\s\S]*?\n {2}\}/
			);
			expect(getStatusMatch).toBeTruthy();
			expect(getStatusMatch?.[0] ?? "").not.toContain('"Content-Type"');
		});
	});
});
