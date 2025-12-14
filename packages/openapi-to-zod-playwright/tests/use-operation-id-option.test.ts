import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("useOperationId Option", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	describe("useOperationId: true (default)", () => {
		it("should use operationId for method names when available", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				useOperationId: true, // Explicit true
			});

			const clientOutput = generator.generateClientString();

			// Should use operationIds from the spec
			expect(clientOutput).toContain("async getUsers(");
			expect(clientOutput).toContain("async createUser(");
			expect(clientOutput).toContain("async getUserById(");
			expect(clientOutput).toContain("async deleteUser(");

			// Should NOT use path-based names
			expect(clientOutput).not.toContain("async postUsers(");
			expect(clientOutput).not.toContain("async getUsersByUserId(");
			expect(clientOutput).not.toContain("async deleteUsersByUserId(");
		});

		it("should use operationId by default when option is omitted", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				// useOperationId not specified - should default to true
			});

			const clientOutput = generator.generateClientString();

			// Should use operationIds by default
			expect(clientOutput).toContain("async createUser(");
			expect(clientOutput).toContain("async getUserById(");
			expect(clientOutput).not.toContain("async postUsers(");
		});
	});

	describe("useOperationId: false", () => {
		it("should generate method names from path when useOperationId is false", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				useOperationId: false,
			});

			const clientOutput = generator.generateClientString();

			// Should use path-based names
			expect(clientOutput).toContain("async getUsers(");
			expect(clientOutput).toContain("async postUsers(");
			expect(clientOutput).toContain("async getUsersByUserId(");
			expect(clientOutput).toContain("async deleteUsersByUserId(");

			// Should NOT use operationIds
			expect(clientOutput).not.toContain("async createUser(");
			expect(clientOutput).not.toContain("async getUserById(");
			expect(clientOutput).not.toContain("async deleteUser(");
		});

		it("should work the same way for service generator", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				useOperationId: false,
			});

			const serviceOutput = generator.generateServiceString();

			// Service should use path-based names
			expect(serviceOutput).toContain("async postUsers(");
			expect(serviceOutput).toContain("async getUsersByUserId(");
			expect(serviceOutput).toContain("async deleteUsersByUserId(");

			// Should NOT use operationIds
			expect(serviceOutput).not.toContain("async createUser(");
			expect(serviceOutput).not.toContain("async getUserById(");
			expect(serviceOutput).not.toContain("async deleteUser(");
		});
	});
});
