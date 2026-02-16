import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("Status Codes", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	function generateClientOutput(): string {
		const generator = new OpenApiPlaywrightGenerator({
			useOperationId: false,
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
		});
		return generator.generateClientString();
	}

	function generateServiceOutput(): string {
		const generator = new OpenApiPlaywrightGenerator({
			useOperationId: false,
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
		});
		return generator.generateServiceString();
	}

	it("should generate methods for success responses", () => {
		const output = generateServiceOutput();

		// Service should handle status codes
		expect(output).toContain("200");
		expect(output).toContain("201");
	});

	it("should use expect for status validation", () => {
		const output = generateServiceOutput();

		expect(output).toContain("expect(response.status(), await response.text()).toBe(");
	});

	it("should generate error methods for 4xx/5xx responses", () => {
		const generator = new OpenApiPlaywrightGenerator({
			useOperationId: false,
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
		});
		const schemasOutput = generator.generateSchemasString();
		const serviceOutput = generator.generateServiceString();

		// Schemas should have error schema
		expect(schemasOutput).toContain("errorSchema");
		// Service should have class
		expect(serviceOutput).toContain("export class");
	});

	it("should handle single success response without suffix", () => {
		const output = generateClientOutput();

		// GET /users has only 200, should be getUsers(options?: ...) not getUsers200()
		expect(output).toContain("async getUsers(options?:");
	});

	it("should handle default responses", () => {
		const output = generateClientOutput();

		// Should handle spec without errors
		expect(output).toBeTruthy();
		expect(output).toContain("export class");
	});

	it("should handle multiple status codes for same endpoint", () => {
		const output = generateClientOutput();

		// POST /users has 201 and 400
		expect(output).toContain("postUsers");
	});

	it("should handle 204 No Content", () => {
		const output = generateServiceOutput();

		// DELETE returns 204
		expect(output).toContain("deleteUser");
		expect(output).toContain("Promise<void>");
	});

	it("should handle 404 Not Found", () => {
		const output = generateClientOutput();

		// GET /users/{userId} has 404
		expect(output).toContain("getUsersByUserId");
	});
});
