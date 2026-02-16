import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { OpenApiK6Generator } from "../src/openapi-k6-generator";

describe("Client Imports", () => {
	const fixtureFile = resolve(__dirname, "fixtures/simple-api.yaml");

	describe("client should use only pure K6 types", () => {
		it("should not import any types from generated types file", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateString();

			// Should import K6 types
			expect(clientOutput).toContain('import http from "k6/http"');
			expect(clientOutput).toContain('from "k6/http"');
			expect(clientOutput).toMatch(/import type \{[^}]*Params[^}]*\} from "k6\/http"/);
			expect(clientOutput).toMatch(/import type \{[^}]*Response[^}]*\} from "k6\/http"/);

			// Should import runtime utilities
			expect(clientOutput).toContain('from "@cerios/openapi-to-k6"');
			expect(clientOutput).toContain("cleanBaseUrl");
			expect(clientOutput).toContain("mergeRequestParameters");

			// Should NOT import from types file at all
			expect(clientOutput).not.toContain('from "./types"');

			// Should NOT have any generated types like GetUsersParams, ListUsersHeaders etc.
			// (Params from K6 is allowed, but GetUsersParams, ListUsersParams etc. are not)
			expect(clientOutput).not.toMatch(/Get\w+Params|List\w+Params|Create\w+Params|Update\w+Params/);
			expect(clientOutput).not.toMatch(/Get\w+Headers|List\w+Headers|Create\w+Headers|Update\w+Headers/);
		});

		it("should use options object with requestParameters for K6 Params", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateString();

			// Methods should use options object with requestParameters?: Params
			expect(clientOutput).toContain("requestParameters?: Params");
		});

		it("should return raw Response type, not typed response", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateString();

			// Methods should return Response (K6's raw type)
			expect(clientOutput).toContain("): Response {");

			// Should NOT return typed responses like Response<User>
			expect(clientOutput).not.toContain("Response<User>");
			expect(clientOutput).not.toContain("Response<CreateUserRequest>");
		});

		it("should not parse JSON in client methods", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateString();

			// Client should NOT parse JSON - that's the service's job
			expect(clientOutput).not.toContain(".json()");
		});

		it("should include passthrough documentation in class JSDoc", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
			});

			const clientOutput = generator.generateString();

			expect(clientOutput).toContain("passthrough");
			expect(clientOutput).toContain("raw K6 Response");
		});
	});

	describe("service should import schema types", () => {
		it("should import schema types for response parsing", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
				outputService: "k6/service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./client", "./types");

			// Service should import from types file
			expect(serviceOutput).toContain('from "./types"');

			// Should return K6ServiceResult with typed data
			expect(serviceOutput).toContain("K6ServiceResult<");

			// Should import User type for response parsing
			expect(serviceOutput).toContain("User");
		});

		it("should import K6ServiceResult from package", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
				outputService: "k6/service.ts",
			});

			const serviceOutput = generator.generateServiceString("./client", "./types");

			expect(serviceOutput).toContain('from "@cerios/openapi-to-k6"');
			expect(serviceOutput).toContain("K6ServiceResult");
		});

		it("should import check function from k6", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
				outputService: "k6/service.ts",
			});

			const serviceOutput = generator.generateServiceString("./client", "./types");

			expect(serviceOutput).toContain('import { check } from "k6"');
		});
	});

	describe("client vs service imports comparison", () => {
		it("client and service should have different import patterns", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "k6/client.ts",
				outputTypes: "k6/types.ts",
				outputService: "k6/service.ts",
				useOperationId: true,
			});

			const clientOutput = generator.generateString();
			const serviceOutput = generator.generateServiceString("./client", "./types");

			// Client should NOT have check import
			expect(clientOutput).not.toContain("import { check }");
			// Service SHOULD have check import
			expect(serviceOutput).toContain("import { check }");

			// Client should NOT have K6ServiceResult
			expect(clientOutput).not.toContain("K6ServiceResult");
			// Service SHOULD have K6ServiceResult
			expect(serviceOutput).toContain("K6ServiceResult");

			// Client returns Response
			expect(clientOutput).toContain("): Response {");
			// Service returns K6ServiceResult
			expect(serviceOutput).toContain("): K6ServiceResult<");
		});
	});
});

describe("Config Loader - outputService", () => {
	// Note: These tests verify the schema accepts outputService
	// The actual config loading is tested in integration tests

	it("should accept outputService in generator options", () => {
		const fixtureFile = resolve(__dirname, "fixtures/simple-api.yaml");

		// This should not throw - outputService is now a valid option
		const generator = new OpenApiK6Generator({
			input: fixtureFile,
			outputClient: "k6/client.ts",
			outputTypes: "k6/types.ts",
			outputService: "k6/service.ts",
		});

		expect(generator).toBeDefined();
	});

	it("should work without outputService (optional)", () => {
		const fixtureFile = resolve(__dirname, "fixtures/simple-api.yaml");

		// outputService is optional
		const generator = new OpenApiK6Generator({
			input: fixtureFile,
			outputClient: "k6/client.ts",
			outputTypes: "k6/types.ts",
		});

		expect(generator).toBeDefined();
	});
});
