import { describe, expect, it } from "vitest";
import { ConfigurationError } from "../src/errors";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("File Splitting Validation", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");
	const outputPath = TestUtils.getOutputPath("schemas.ts");

	describe("Service requires client validation", () => {
		it("should throw error when outputService is specified without outputClient", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: outputPath,
				outputService: TestUtils.getOutputPath("service.ts"),
				// No outputClient
			});

			expect(() => generator.generate()).toThrow(ConfigurationError);
			expect(() => generator.generate()).toThrow(
				/Service generation requires client.*Please specify outputClient path/
			);
		});

		it("should include helpful context in error message", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: outputPath,
				outputService: TestUtils.getOutputPath("service.ts"),
			});

			try {
				generator.generate();
				expect.fail("Should have thrown ConfigurationError");
			} catch (error) {
				expect(error).toBeInstanceOf(ConfigurationError);
				expect((error as ConfigurationError).message).toContain("Service class depends on client class");
			}
		});
	});

	describe("Valid configurations", () => {
		it("should accept schemas only (no client, no service)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: outputPath,
				// No outputClient, no outputService
			});

			expect(() => generator.generate()).not.toThrow();
		});

		it("should accept schemas + client (no service)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: outputPath,
				outputClient: TestUtils.getOutputPath("client.ts"),
				// No outputService
			});

			expect(() => generator.generate()).not.toThrow();
		});

		it("should accept schemas + client + service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: outputPath,
				outputClient: TestUtils.getOutputPath("client.ts"),
				outputService: TestUtils.getOutputPath("service.ts"),
			});

			expect(() => generator.generate()).not.toThrow();
		});
	});

	describe("generateSchemasString() behavior", () => {
		it("should return only schemas and types (no client, no service)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
			});

			const output = generator.generateSchemasString();

			// Should contain schemas
			expect(output).toContain("export const");
			expect(output).toContain("export type");
			expect(output).toContain('import { z } from "zod"');

			// Should NOT contain client or service
			expect(output).not.toContain("APIRequestContext");
			expect(output).not.toContain("APIResponse");
			expect(output).not.toContain("class");
			expect(output).not.toContain("async ");
		});

		it("should not include Playwright imports in schemas-only output", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
			});

			const output = generator.generateSchemasString();

			expect(output).not.toContain("@playwright/test");
			expect(output).not.toContain("expect");
		});
	});
});
