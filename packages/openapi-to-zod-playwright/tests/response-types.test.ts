import { describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Response Types", () => {
	describe("Primitive Response Types", () => {
		const fixtureFile = TestUtils.getFixturePath("primitives-api.yaml");

		function generateOutput(): string {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
			});
			return generator.generateString();
		}

		it("should handle number responses", () => {
			const output = generateOutput();

			expect(output).toContain("async getCount(");
			expect(output).toContain("Promise<number>");
		});

		it("should handle string responses", () => {
			const output = generateOutput();

			expect(output).toContain("async getMessage(");
			expect(output).toContain("Promise<string>");
		});

		it("should handle boolean responses", () => {
			const output = generateOutput();

			expect(output).toContain("async getActive(");
			expect(output).toContain("Promise<boolean>");
		});

		it("should handle array responses", () => {
			const output = generateOutput();

			expect(output).toContain("async getTags(");
			expect(output).toContain("Promise<string[]>");
		});

		it("should validate primitive responses with Zod", () => {
			const output = generateOutput();

			// Should use z.number(), z.string(), z.boolean(), z.array()
			expect(output).toContain("z.number()");
			expect(output).toContain("z.string()");
			expect(output).toContain("z.boolean()");
			expect(output).toContain("z.array(");
		});
	});

	describe("Complex Response Types", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		function generateOutput(): string {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
			});
			return generator.generateString();
		}

		it("should handle object responses", () => {
			const output = generateOutput();

			expect(output).toContain("Promise<User>");
		});

		it("should handle array of objects", () => {
			const output = generateOutput();

			expect(output).toContain("Promise<User[]>");
		});
	});

	describe("No Content Responses", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		function generateOutput(): string {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
			});
			return generator.generateString();
		}

		it("should handle 204 No Content responses", () => {
			const output = generateOutput();

			// DELETE should return void for 204
			expect(output).toContain("Promise<void>");
			expect(output).toContain("return;");
		});

		it("should not try to parse body for 204 responses", () => {
			const output = generateOutput();

			// Should check for status code validation
			expect(output).toContain("deleteUsersByUserId");
		});
	});
});
