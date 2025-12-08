import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";

describe("PlaywrightGenerator", () => {
	const outputDir = "tests/output";
	const outputPath = `${outputDir}/simple-api.ts`;

	beforeEach(() => {
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true });
		}
	});

	afterEach(() => {
		if (existsSync(outputPath)) {
			rmSync(outputPath);
		}
	});

	it("should generate schemas, client, and service classes", () => {
		const generator = new PlaywrightGenerator({
			input: "tests/fixtures/simple-api.yaml",
			output: outputPath,
		});

		generator.generate();

		expect(existsSync(outputPath)).toBe(true);

		const output = readFileSync(outputPath, "utf-8");

		// Check for Zod schemas
		expect(output).toContain("export const userSchema");
		expect(output).toContain("export const createUserRequestSchema");
		expect(output).toContain("export const errorSchema");

		// Check for Playwright imports
		expect(output).toContain('import type { APIRequestContext, APIResponse } from "@playwright/test"');
		expect(output).toContain('import { expect } from "@playwright/test"');

		// Check for ApiClient class
		expect(output).toContain("export class ApiClient");
		expect(output).toContain("constructor(private readonly request: APIRequestContext)");

		// Check for ApiService class
		expect(output).toContain("export class ApiService");
		expect(output).toContain("constructor(private readonly client: ApiClient)");
	});

	it("should generate client methods with correct names", () => {
		const generator = new PlaywrightGenerator({
			input: "tests/fixtures/simple-api.yaml",
			output: outputPath,
		});

		generator.generate();

		const output = readFileSync(outputPath, "utf-8");

		// Check client method names
		expect(output).toContain("async getUsers(");
		expect(output).toContain("async postUsers(");
		expect(output).toContain("async getUsersByUserId(userId: string");
		expect(output).toContain("async deleteUsersByUserId(userId: string");
	});

	it("should generate service methods with status codes for multiple responses", () => {
		const generator = new PlaywrightGenerator({
			input: "tests/fixtures/simple-api.yaml",
			output: outputPath,
		});

		generator.generate();

		const output = readFileSync(outputPath, "utf-8");

		// GET /users has only 200 - no suffix
		expect(output).toContain("async getUsers()");

		// POST /users has only 201 (400 is error) - no suffix for single success response
		expect(output).toContain("async postUsers(options?: { data?: CreateUserRequest })");

		// GET /users/{userId} has only 200 - no suffix
		expect(output).toContain("async getUsersByUserId(userId: string");

		// DELETE /users/{userId} has only 204 - no suffix
		expect(output).toContain("async deleteUsersByUserId(userId: string");
	});

	it("should generate error methods for endpoints with error responses", () => {
		const generator = new PlaywrightGenerator({
			input: "tests/fixtures/simple-api.yaml",
			output: outputPath,
		});

		generator.generate();

		const output = readFileSync(outputPath, "utf-8");

		// POST /users has 400 error - should have error method
		expect(output).toContain("async postUsersError(options?: { data?: any })");

		// GET /users/{userId} has 404 error - should have error method
		expect(output).toContain("async getUsersByUserIdError(userId: string, options?: {  })");
	});

	it("should use expect for status validation", () => {
		const generator = new PlaywrightGenerator({
			input: "tests/fixtures/simple-api.yaml",
			output: outputPath,
		});

		generator.generate();

		const output = readFileSync(outputPath, "utf-8");

		// Check for Playwright expect usage
		expect(output).toContain("expect(response.status()).toBe(200)");
		expect(output).toContain("expect(response.status()).toBe(201)");
		expect(output).toContain("expect(response.status()).toBe(204)");
	});

	it("should return null for 204 responses", () => {
		const generator = new PlaywrightGenerator({
			input: "tests/fixtures/simple-api.yaml",
			output: outputPath,
		});

		generator.generate();

		const output = readFileSync(outputPath, "utf-8");

		// DELETE returns 204 with null
		expect(output).toContain("async deleteUsersByUserId(userId: string, options?: {  }): Promise<null>");
		expect(output).toContain("return null;");
	});

	it("should make all client options partial", () => {
		const generator = new PlaywrightGenerator({
			input: "tests/fixtures/simple-api.yaml",
			output: outputPath,
		});

		generator.generate();

		const output = readFileSync(outputPath, "utf-8");

		// Client methods should have Partial<> for options
		expect(output).toContain(
			"options?: Partial<{ query?: Record<string, any>; headers?: Record<string, string>; data?: any"
		);
	});
});
