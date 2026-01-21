import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

const FIXTURES_DIR = resolve(__dirname, "fixtures");

describe("zodErrorFormat option", () => {
	describe("standard format (default)", () => {
		it("should use parseAsync for response validation by default", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
			});

			const serviceString = generator.generateServiceString();

			// Should use parseAsync for response validation
			expect(serviceString).toContain(".parseAsync(body)");
			// Should NOT contain prettify helper functions
			expect(serviceString).not.toContain("parseWithPrettifyError");
			expect(serviceString).not.toContain("parseWithPrettifyErrorWithValues");
			expect(serviceString).not.toContain("formatZodErrorPath");
			expect(serviceString).not.toContain("formatZodErrorWithValues");
		});

		it("should use parseAsync for request validation with standard format", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "standard",
			});

			const serviceString = generator.generateServiceString();

			// Should use parseAsync for request validation
			expect(serviceString).toContain(".parseAsync(options.data)");
		});
	});

	describe("prettify format", () => {
		it("should generate prettify helper function", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should contain the helper method (private method inside class)
			expect(serviceString).toContain("private async parseWithPrettifyError<T>");
			expect(serviceString).toContain("schema.safeParseAsync(data)");
			expect(serviceString).toContain("z.prettifyError(result.error)");
			expect(serviceString).toContain("{ cause: result.error }");
		});

		it("should use parseWithPrettifyError for response validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should use the helper method for response parsing
			expect(serviceString).toContain("this.parseWithPrettifyError(");
			expect(serviceString).toContain(", body)");
		});

		it("should use parseWithPrettifyError for request validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should use the helper method for request validation
			expect(serviceString).toContain("this.parseWithPrettifyError(");
			expect(serviceString).toContain(", options.data)");
		});

		it("should NOT contain prettifyWithValues helper", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			expect(serviceString).not.toContain("parseWithPrettifyErrorWithValues");
			expect(serviceString).not.toContain("formatZodErrorPath");
			expect(serviceString).not.toContain("formatZodErrorWithValues");
		});
	});

	describe("prettifyWithValues format", () => {
		it("should generate all required helper functions", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should contain all helper methods (private methods inside class)
			expect(serviceString).toContain("private formatZodErrorPath(path: PropertyKey[])");
			expect(serviceString).toContain("private formatZodErrorWithValues(error: z.ZodError, input: unknown)");
			expect(serviceString).toContain("private async parseWithPrettifyErrorWithValues<T>");
		});

		it("should include value extraction logic", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should contain value extraction
			expect(serviceString).toContain("issue.path.reduce");
			expect(serviceString).toContain("(received:");
			expect(serviceString).toContain("JSON.stringify(value)");
		});

		it("should format paths correctly", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should handle numeric array indices and object keys
			expect(serviceString).toContain('typeof segment.valueOf() === "number"');
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Needed for testing
			expect(serviceString).toContain("[${segment.toString()}]");
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Needed for testing
			expect(serviceString).toContain(".${segment.toString()}");
		});

		it("should use parseWithPrettifyErrorWithValues for validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should use the helper function
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues(");
		});

		it("should use parseWithPrettifyErrorWithValues for request validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should use the helper function for request validation
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues(");
			expect(serviceString).toContain(", options.data)");
		});

		it("should NOT contain simple prettify helper", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			expect(serviceString).not.toContain("parseWithPrettifyError<T>");
			// But should contain the WithValues version
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues<T>");
		});
	});

	describe("generated service file imports", () => {
		it("should import z from zod when using prettify format", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				outputClient: resolve(FIXTURES_DIR, "../output/test-client.ts"),
				outputService: resolve(FIXTURES_DIR, "../output/test-service.ts"),
				zodErrorFormat: "prettify",
			});

			// Access private method for testing
			const serviceFile = (generator as any).generateServiceFile(
				resolve(FIXTURES_DIR, "../output/test-service.ts"),
				resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				resolve(FIXTURES_DIR, "../output/test-client.ts")
			);

			expect(serviceFile).toContain('import { z } from "zod"');
		});

		it("should import z from zod when using prettifyWithValues format", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				outputClient: resolve(FIXTURES_DIR, "../output/test-client.ts"),
				outputService: resolve(FIXTURES_DIR, "../output/test-service.ts"),
				zodErrorFormat: "prettifyWithValues",
			});

			// Access private method for testing
			const serviceFile = (generator as any).generateServiceFile(
				resolve(FIXTURES_DIR, "../output/test-service.ts"),
				resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				resolve(FIXTURES_DIR, "../output/test-client.ts")
			);

			expect(serviceFile).toContain('import { z } from "zod"');
		});
	});

	describe("query and header parameter validation", () => {
		it("should use correct format for query param validation with prettify", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "query-params-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should use prettify helper for query params
			expect(serviceString).toContain("parseWithPrettifyError(");
			expect(serviceString).toContain("options.params)");
		});

		it("should use correct format for header param validation with prettifyWithValues", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "headers-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should use prettifyWithValues helper for headers
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues(");
			expect(serviceString).toContain("options.headers)");
		});
	});

	describe("inline schema validation", () => {
		it("should use correct format for inline schemas with prettify", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "inline-schema-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should use prettify helper even for inline schemas
			expect(serviceString).toContain("parseWithPrettifyError(");
		});

		it("should use correct format for inline schemas with prettifyWithValues", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "inline-schema-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should use prettifyWithValues helper for inline schemas
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues(");
		});
	});

	describe("error format produces valid TypeScript", () => {
		it("should produce valid helper function syntax for prettify", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Verify the method signature is correct TypeScript (private method)
			expect(serviceString).toMatch(
				/private async parseWithPrettifyError<T>\(schema: z\.ZodType<T>, data: unknown\): Promise<T>/
			);
		});

		it("should produce valid helper method syntax for prettifyWithValues", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Verify all method signatures are correct TypeScript (private methods)
			expect(serviceString).toMatch(/private formatZodErrorPath\(path: PropertyKey\[\]\): string/);
			expect(serviceString).toMatch(/private formatZodErrorWithValues\(error: z\.ZodError, input: unknown\): string/);
			expect(serviceString).toMatch(
				/private async parseWithPrettifyErrorWithValues<T>\(schema: z\.ZodType<T>, data: unknown\): Promise<T>/
			);
		});
	});
});
