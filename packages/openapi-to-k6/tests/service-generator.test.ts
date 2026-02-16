import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { OpenApiK6Generator } from "../src/openapi-k6-generator";

describe("Service Generator", () => {
	const fixtureFile = resolve(__dirname, "fixtures/simple-api.yaml");

	describe("generateServiceString", () => {
		it("should generate service code when outputService is provided", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const clientImportPath = "./test-client";
			const typesImportPath = "./test-types";
			const output = generator.generateServiceString(clientImportPath, typesImportPath);

			expect(output).toContain('import { check } from "k6"');
			expect(output).toContain('from "@cerios/openapi-to-k6"');
			expect(output).toContain("K6ServiceResult");
			expect(output).toContain("export class");
			expect(output).toContain("Service");
		});

		it("should import client class from specified path", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "api-client.ts",
				outputTypes: "api-types.ts",
				outputService: "api-service.ts",
			});

			const output = generator.generateServiceString("./api-client", "./api-types");

			expect(output).toContain('import { ApiClient } from "./api-client"');
		});

		it("should import types from specified path", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain('from "./test-types"');
		});

		it("should generate service class with client dependency injection", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("private readonly _client:");
			expect(output).toContain("constructor(client:");
			expect(output).toContain("this._client = client;");
		});

		it("should generate methods for each endpoint", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			// Should have service methods for users endpoints
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
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("listUsers(");
			expect(output).toContain("createUser(");
			expect(output).toContain("getUserById(");
			expect(output).toContain("updateUser(");
			expect(output).toContain("deleteUser(");
		});
	});

	describe("K6ServiceResult return type", () => {
		it("should return K6ServiceResult with typed data", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			// Should return K6ServiceResult with actual types
			expect(output).toContain("K6ServiceResult<User>");
		});

		it("should return K6ServiceResult<unknown> when response type is not defined", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			// Delete endpoints may return void or unknown
			expect(output).toMatch(/K6ServiceResult<(void|unknown)>/);
		});

		it("should include response, data, and ok in return statement", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("return { response, data, ok };");
		});
	});

	describe("status code validation", () => {
		it("should use K6 check function for status validation", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("const ok = check(response, {");
		});

		it("should check against expected status code from OpenAPI spec", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			// GET /users returns 200
			expect(output).toContain("status is 200");
			// POST /users returns 201
			expect(output).toContain("status is 201");
		});

		it("should log failure details on status mismatch", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("console.log(`");
			expect(output).toContain("failed with status:");
			expect(output).toContain("${r.status}");
			expect(output).toContain("${r.body}");
		});

		it("should return status check result in ok property", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			// ok should come from check() result
			expect(output).toContain("const ok = check(");
			expect(output).toContain("return { response, data, ok };");
		});
	});

	describe("client method delegation", () => {
		it("should call client method with same parameters", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			// Service should call client methods
			expect(output).toContain("this._client.getUsers(");
			expect(output).toContain("this._client.getUsersByUserId(");
		});

		it("should pass path parameters to client", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			// userId should be passed to client
			expect(output).toMatch(/this\._client\.getUsersByUserId\(userId/);
		});

		it("should pass requestParameters to client via options object", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("requestParameters?: Params");
			// requestParameters are passed directly in the options object
			expect(output).toContain("{ requestParameters }");
		});
	});

	describe("response body parsing", () => {
		it("should parse JSON response body", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("response.json()");
		});

		it("should cast response to correct type", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("as User");
		});
	});

	describe("JSDoc generation", () => {
		it("should include method description when enabled", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				includeDescriptions: true,
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("@summary");
		});

		it("should include HTTP method and path", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("@method GET /users");
			expect(output).toContain("@method POST /users");
		});

		it("should indicate K6ServiceResult return type in JSDoc", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
			});

			const output = generator.generateServiceString("./test-client", "./test-types");

			expect(output).toContain("@returns K6ServiceResult");
		});
	});
});

describe("Client Generator (passthrough)", () => {
	const fixtureFile = resolve(__dirname, "fixtures/simple-api.yaml");

	describe("return type", () => {
		it("should return raw Response instead of { response, data }", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			// Should return Response directly
			expect(output).toContain("): Response {");
			// Should NOT return { response, data }
			expect(output).not.toContain("return { response, data };");
		});

		it("should return http.request result directly", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			expect(output).toContain("return http.request(");
		});

		it("should not include JSON parsing in client", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			// Client should NOT parse JSON - that's the service's job
			expect(output).not.toContain("response.json()");
			expect(output).not.toContain("const data =");
		});
	});

	describe("K6 types only", () => {
		it("should import only K6 types", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			expect(output).toContain('import http from "k6/http"');
			expect(output).toMatch(/import type \{[^}]*Params[^}]*\} from "k6\/http"/);
			expect(output).toMatch(/import type \{[^}]*Response[^}]*\} from "k6\/http"/);
		});

		it("should not import K6ServiceResult in client", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			expect(output).not.toContain("K6ServiceResult");
		});

		it("should not import check function in client", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
			});

			const output = generator.generateString();

			expect(output).not.toContain("import { check }");
		});
	});
});

describe("Client-Service Integration", () => {
	const fixtureFile = resolve(__dirname, "fixtures/simple-api.yaml");

	it("should generate matching method names in client and service", () => {
		const generator = new OpenApiK6Generator({
			input: fixtureFile,
			outputClient: "test-client.ts",
			outputTypes: "test-types.ts",
			outputService: "test-service.ts",
		});

		const clientCode = generator.generateString();
		const serviceCode = generator.generateServiceString("./test-client", "./test-types");

		// Extract method names from client
		const clientMethodMatches = clientCode.matchAll(/^\s+(\w+)\([^)]*\): Response \{/gm);
		const clientMethods = Array.from(clientMethodMatches, m => m[1]);

		// Service should call each client method
		for (const method of clientMethods) {
			expect(serviceCode).toContain(`this._client.${method}(`);
		}
	});

	it("should generate client class name based on output path", () => {
		const generator = new OpenApiK6Generator({
			input: fixtureFile,
			outputClient: "my-api-client.ts",
			outputTypes: "my-api-types.ts",
			outputService: "my-api-service.ts",
		});

		const clientCode = generator.generateString();
		const serviceCode = generator.generateServiceString("./my-api-client", "./my-api-types");

		expect(clientCode).toContain("export class MyApiClient");
		expect(serviceCode).toContain("export class MyApiService");
		expect(serviceCode).toContain("import { MyApiClient }");
	});

	it("should generate service class that depends on client class", () => {
		const generator = new OpenApiK6Generator({
			input: fixtureFile,
			outputClient: "test-client.ts",
			outputTypes: "test-types.ts",
			outputService: "test-service.ts",
		});

		const serviceCode = generator.generateServiceString("./test-client", "./test-types");

		// Service constructor should accept client
		expect(serviceCode).toMatch(/constructor\(client: \w+Client\)/);
		// Service should store client as private field
		expect(serviceCode).toContain("private readonly _client:");
	});
});
