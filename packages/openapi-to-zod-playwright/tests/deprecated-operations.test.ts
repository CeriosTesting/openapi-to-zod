import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Deprecated Operations", () => {
	const fixturePath = TestUtils.getFixturePath("deprecated-api.yaml");

	it("should generate @deprecated JSDoc tag for deprecated operations in client", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixturePath,
		});
		const client = generator.generateClientString();

		// Check for @deprecated tag in JSDoc for the /old-endpoint operation
		expect(client).toContain("@deprecated");
		expect(client).toContain("async getOldEndpoint(");
	});

	it("should generate @deprecated JSDoc tag for deprecated operations in service", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixturePath,
		});
		const service = generator.generateServiceString();

		// Check for @deprecated tag in JSDoc for the /old-endpoint operation
		expect(service).toContain("@deprecated");
		expect(service).toContain("async getOldEndpoint");
	});

	it("should include operation summary in JSDoc", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixturePath,
		});
		const client = generator.generateClientString();

		// Check for summary in JSDoc for /users endpoint
		expect(client).toContain("Get all users");
		expect(client).toContain("async getUsers(");
	});

	it("should include operation description in JSDoc", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixturePath,
		});
		const client = generator.generateClientString();

		// Check for description in JSDoc for /users endpoint
		expect(client).toContain("Retrieves a list of all registered users in the system");
		expect(client).toContain("async getUsers(");
	});

	it("should include both summary and @deprecated for deprecated operations", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixturePath,
		});
		const client = generator.generateClientString();

		// Check for both summary and @deprecated for /old-users endpoint
		expect(client).toContain("Get users (old endpoint)");
		expect(client).toContain("@deprecated");
		expect(client).toContain("async getOldUsers(");
	});

	it("should sanitize JSDoc content to prevent injection attacks", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixturePath,
		});
		const client = generator.generateClientString();

		// Check that */ is escaped in /malicious endpoint
		expect(client).toContain("*\\/");
		// Check that @ symbols are escaped
		expect(client).toContain("\\@param");
		// Method should still be generated
		expect(client).toContain("async getMalicious(");
	});

	it("should handle operations without summary, description, or deprecated", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixturePath,
		});
		const client = generator.generateClientString();

		// Should still generate JSDoc with basic info for /minimal endpoint
		expect(client).toContain("/**");
		expect(client).toContain("@returns");
		expect(client).toContain("async getMinimal(");
		// Extract just the getMinimal method by looking for the pattern after getMalicious
		// This ensures we're only checking the JSDoc directly before getMinimal
		const afterMalicious = client.substring(client.indexOf("async getMalicious"));
		const getMinimalMatch = afterMalicious.match(/\/\*\*[\s\S]*?\*\/\s*async getMinimal\(/);
		expect(getMinimalMatch).toBeTruthy();
		if (getMinimalMatch) {
			expect(getMinimalMatch[0]).not.toContain("@deprecated");
		}
	});

	it("should generate proper multi-line JSDoc format", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixturePath,
		});
		const client = generator.generateClientString();

		// Check for proper JSDoc structure for /complex endpoint
		expect(client).toContain("/**");
		expect(client).toContain(" * Complex operation");
		expect(client).toContain(" * @deprecated");
		expect(client).toContain(" * @returns");
		expect(client).toContain(" */");
	});

	it("should handle deprecated operations with request bodies in service", () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixturePath,
		});
		const service = generator.generateServiceString();

		// Check for @deprecated in service method for /old-create endpoint
		expect(service).toContain("@deprecated");
		expect(service).toContain("Create user (deprecated)");
		expect(service).toContain("async postOldCreate");
	});
});
