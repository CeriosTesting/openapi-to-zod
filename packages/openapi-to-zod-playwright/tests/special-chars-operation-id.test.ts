import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Special Characters in operationId", () => {
	const fixtureFile = TestUtils.getFixturePath("special-chars-operation-ids.yaml");

	it("should sanitize kebab-case operationIds to camelCase", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
			useOperationId: true,
		});

		const clientOutput = generator.generateClientString();
		const serviceOutput = generator.generateServiceString();

		// Client should have camelCase method names
		expect(clientOutput).toContain("async getAllUsers(");
		expect(clientOutput).toContain("async createNewUser(");
		expect(clientOutput).toContain("async getUserById(");
		expect(clientOutput).toContain("async deleteUserById(");

		// Should NOT contain kebab-case method names
		expect(clientOutput).not.toContain("async get-all-users(");
		expect(clientOutput).not.toContain("async create-new-user(");

		// Service should also have camelCase method names
		expect(serviceOutput).toContain("async getAllUsers(");
		expect(serviceOutput).toContain("async createNewUser(");
		expect(serviceOutput).toContain("async getUserById(");
		expect(serviceOutput).toContain("async deleteUserById(");
	});

	it("should sanitize snake_case operationIds to camelCase", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
			useOperationId: true,
		});

		const clientOutput = generator.generateClientString();

		// Should convert snake_case to camelCase
		expect(clientOutput).toContain("async getAllItems(");
		expect(clientOutput).toContain("async createNewItem(");

		// Should NOT contain snake_case
		expect(clientOutput).not.toContain("async get_all_items(");
		expect(clientOutput).not.toContain("async create_new_item(");
	});

	it("should convert PascalCase operationIds to camelCase", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
			useOperationId: true,
		});

		const clientOutput = generator.generateClientString();

		// Should convert PascalCase to camelCase
		expect(clientOutput).toContain("async getAllProducts(");
		expect(clientOutput).toContain("async createProduct(");

		// Should NOT contain PascalCase
		expect(clientOutput).not.toContain("async GetAllProducts(");
		expect(clientOutput).not.toContain("async CreateProduct(");
	});

	it("should preserve already valid camelCase operationIds", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
			useOperationId: true,
		});

		const clientOutput = generator.generateClientString();

		// Should preserve valid camelCase as-is
		expect(clientOutput).toContain("async getAllOrders(");
		expect(clientOutput).toContain("async createOrder(");
	});

	it("should handle mixed special characters", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
			useOperationId: true,
		});

		const clientOutput = generator.generateClientString();

		// Should sanitize all special characters
		expect(clientOutput).toContain("async getDailyReportV2(");
		expect(clientOutput).not.toContain("get_daily-report.v2");
	});

	it("should handle operationIds starting with numbers by prefixing with underscore", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			output: "output.ts",
			outputClient: "client.ts",
			useOperationId: true,
		});

		const clientOutput = generator.generateClientString();

		// Should prefix with underscore when starting with number
		expect(clientOutput).toContain("async _2faValidate(");
	});
});
