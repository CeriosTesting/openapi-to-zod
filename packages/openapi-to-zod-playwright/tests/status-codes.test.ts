import { describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Status Codes", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

	function generateOutput(): string {
		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});
		return generator.generateString();
	}

	it("should generate methods for success responses", () => {
		const output = generateOutput();

		// Should have methods for 200, 201 responses
		expect(output).toContain("200");
		expect(output).toContain("201");
	});

	it("should use expect for status validation", () => {
		const output = generateOutput();

		expect(output).toContain("expect(response.status()).toBe(");
	});

	it("should generate error methods for 4xx/5xx responses", () => {
		const output = generateOutput();

		// Service should handle 400 and 404 responses
		expect(output).toContain("errorSchema");
		expect(output).toContain("export class ApiService");
	});

	it("should handle single success response without suffix", () => {
		const output = generateOutput();

		// GET /users has only 200, should be getUsers() not getUsers200()
		expect(output).toContain("async getUsers()");
	});

	it("should handle default responses", () => {
		const output = generateOutput();

		// Should handle spec without errors
		expect(output).toBeTruthy();
		expect(output).toContain("export class ApiClient");
	});

	it("should handle multiple status codes for same endpoint", () => {
		const output = generateOutput();

		// POST /users has 201 and 400
		expect(output).toContain("postUsers");
	});

	it("should handle 204 No Content", () => {
		const output = generateOutput();

		// DELETE returns 204
		expect(output).toContain("deleteUsersByUserId");
		expect(output).toContain("Promise<void>");
	});

	it("should handle 404 Not Found", () => {
		const output = generateOutput();

		// GET /users/{userId} has 404
		expect(output).toContain("getUsersByUserId");
	});
});
