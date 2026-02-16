import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("File Splitting Validation", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");
	const outputPath = TestUtils.getOutputPath("schemas.ts");
	const clientPath = TestUtils.getOutputPath("client.ts");

	describe("Valid configurations", () => {
		it("should accept schemas + client (no service)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: outputPath,
				outputClient: clientPath,
				// No outputService
			});

			expect(() => generator.generate()).not.toThrow();
		});

		it("should accept schemas + client + service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: outputPath,
				outputClient: clientPath,
				outputService: TestUtils.getOutputPath("service.ts"),
			});

			expect(() => generator.generate()).not.toThrow();
		});
	});

	describe("generateSchemasString() behavior", () => {
		it("should return only schemas and types (no client, no service)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: outputPath,
				outputClient: clientPath,
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
				outputTypes: outputPath,
				outputClient: clientPath,
			});

			const output = generator.generateSchemasString();

			expect(output).not.toContain("@playwright/test");
			expect(output).not.toContain("expect");
		});
	});
});
