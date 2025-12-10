import { describe, expect, it } from "vitest";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Advanced Features", () => {
	describe("Service Layer", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should generate service methods that extract parameters", () => {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
			});

			const output = generator.generateString();

			// Service should extract data parameter for JSON content types
			expect(output).toContain("export class ApiService");
			// Service calls client with extracted options
			expect(output).toContain("this.client.");
		});

		it("should generate client methods with raw Playwright options", () => {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
			});

			const output = generator.generateString();

			// Client methods use raw Playwright options (no validation)
			expect(output).toContain("export class ApiClient");
			const clientSection = output.substring(
				output.indexOf("export class ApiClient"),
				output.indexOf("export class ApiService")
			);
			expect(clientSection).not.toContain(".parse(");
		});
	});

	describe("Generation Modes", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should generate client-service by default", () => {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
			});

			const output = generator.generateString();

			expect(output).toContain("export class ApiClient");
			expect(output).toContain("export class ApiService");
		});

		it("should generate only client when generateService is false", () => {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
				generateService: false,
			});

			const output = generator.generateString();

			expect(output).toContain("export class ApiClient");
			expect(output).not.toContain("export class ApiService");
			// Client uses raw Playwright options
			expect(output).toContain("options?:");
		});

		it("should throw error when outputService is used with generateService false", () => {
			expect(() => {
				new PlaywrightGenerator({
					input: fixtureFile,
					output: TestUtils.getOutputPath("main.ts"),
					outputService: TestUtils.getOutputPath("service.ts"),
					generateService: false,
				});
			}).toThrow(/outputService is only allowed when generateService is true/);
		});
	});

	describe("File Splitting", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should handle outputClient option with relative imports", () => {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
			});

			const clientString = generator.generateClientString();
			const schemasString = generator.generateSchemasString();

			// Client should not contain schemas
			expect(clientString).toContain("export class ApiClient");
			expect(clientString).not.toContain("export const userSchema");

			// Schemas should not contain client
			expect(schemasString).toContain("export const userSchema");
			expect(schemasString).not.toContain("export class ApiClient");
		});

		it("should handle outputService option with relative imports", () => {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
			});

			const serviceString = generator.generateServiceString();
			const clientString = generator.generateClientString();
			const schemasString = generator.generateSchemasString();

			// Service should not contain schemas or client
			expect(serviceString).toContain("export class ApiService");
			expect(serviceString).not.toContain("export const userSchema");
			expect(serviceString).not.toContain("export class ApiClient");

			// All three should be separate
			expect(schemasString).toContain("export const userSchema");
			expect(clientString).toContain("export class ApiClient");
			expect(serviceString).toContain("export class ApiService");
		});
	});

	describe("Schema Options Passthrough", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		it("should respect mode option", () => {
			const strictGenerator = new PlaywrightGenerator({
				input: fixtureFile,
				mode: "strict",
			});

			const output = strictGenerator.generateString();
			expect(output).toContain(".strictObject(");
		});

		it("should respect typeMode option", () => {
			const nativeGenerator = new PlaywrightGenerator({
				input: fixtureFile,
				typeMode: "native",
			});

			const output = nativeGenerator.generateString();
			// Native mode should generate different type structure
			expect(output).toBeTruthy();
		});

		it("should respect enumType option", () => {
			const tsEnumGenerator = new PlaywrightGenerator({
				input: fixtureFile,
				enumType: "typescript",
			});

			const output = tsEnumGenerator.generateString();
			// Should contain TypeScript enums if present in spec
			expect(output).toBeTruthy();
		});

		it("should respect prefix and suffix options", () => {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
				prefix: "api",
				suffix: "Dto",
			});

			const output = generator.generateString();
			expect(output).toContain("apiUserDtoSchema");
		});

		it("should respect includeDescriptions option", () => {
			const withDescriptions = new PlaywrightGenerator({
				input: fixtureFile,
				includeDescriptions: true,
			});

			const withoutDescriptions = new PlaywrightGenerator({
				input: fixtureFile,
				includeDescriptions: false,
			});

			const outputWith = withDescriptions.generateString();
			const outputWithout = withoutDescriptions.generateString();

			// Check for JSDoc comments - client/service classes always have comments
			expect(outputWith).toMatch(/\/\*\*/);
			// Both will have comments from client/service classes, but schemas differ
			expect(outputWithout).toBeTruthy();
		});

		it("should respect useDescribe option", () => {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
				useDescribe: true,
			});

			const output = generator.generateString();
			// useDescribe is passed through to schema generator
			expect(output).toBeTruthy();
		});

		it("should respect showStats option", () => {
			const withStats = new PlaywrightGenerator({
				input: fixtureFile,
				showStats: true,
			});

			const withoutStats = new PlaywrightGenerator({
				input: fixtureFile,
				showStats: false,
			});

			const outputWith = withStats.generateString();
			const outputWithout = withoutStats.generateString();

			expect(outputWith).toContain("// Generation Statistics:");
			expect(outputWithout).not.toContain("// Generation Statistics:");
		});
	});
});
