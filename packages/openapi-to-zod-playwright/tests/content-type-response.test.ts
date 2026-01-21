import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Content Type Response Handling", () => {
	describe("JSON content types", () => {
		it("should use .json() for application/json responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// Should use response.json() for application/json
			expect(serviceOutput).toContain("response.json()");
		});

		it("should use .json() for text/json responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("multi-response-content-types-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
				preferredContentTypes: ["text/json"],
			});

			const serviceOutput = generator.generateServiceString();

			// text/json should be parsed as JSON
			expect(serviceOutput).toContain("response.json()");
		});

		it("should use .json() for application/vnd.api+json responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("content-types-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// +json suffix should use response.json()
			if (serviceOutput.includes("VndApi")) {
				expect(serviceOutput).toContain("response.json()");
			}
		});
	});

	describe("Text content types", () => {
		it("should use .text() for text/plain responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// Should use response.text() for text/plain
			expect(serviceOutput).toContain("response.text()");
		});

		it("should use .text() for text/html responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// getConfig returns text/html, should use .text()
			expect(serviceOutput).toMatch(/getConfig[\s\S]*?response\.text\(\)/);
		});

		it("should use .text() for application/xml responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// getXmlData returns application/xml, should use .text()
			expect(serviceOutput).toMatch(/getXmlData[\s\S]*?response\.text\(\)/);
		});
	});

	describe("Binary content types", () => {
		it("should use .body() for image/* responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// getImage returns image/png, should use .body()
			expect(serviceOutput).toMatch(/getImage[\s\S]*?response\.body\(\)/);
		});

		it("should use .body() for application/pdf responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// getDocument returns application/pdf, should use .body()
			expect(serviceOutput).toMatch(/getDocument[\s\S]*?response\.body\(\)/);
		});

		it("should use .body() for application/zip responses", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// getArchive returns application/zip, should use .body()
			expect(serviceOutput).toMatch(/getArchive[\s\S]*?response\.body\(\)/);
		});
	});

	describe("Unknown content types with fallback", () => {
		let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		});

		afterEach(() => {
			consoleWarnSpy.mockRestore();
		});

		it("should use .text() by default for unknown content types (safest)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// getCustom returns application/x-custom-type, should use .text() by default
			expect(serviceOutput).toMatch(/getCustom[\s\S]*?response\.text\(\)/);
		});

		it("should emit warning for unknown content types", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
			});

			generator.generateServiceString();

			// Should have warned about unknown content type
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown content type"));
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("application/x-custom-type"));
		});

		it("should use .json() when fallbackContentTypeParsing is 'json'", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
				fallbackContentTypeParsing: "json",
			});

			const serviceOutput = generator.generateServiceString();

			// getCustom should now use .json()
			expect(serviceOutput).toMatch(/getCustom[\s\S]*?response\.json\(\)/);
		});

		it("should use .body() when fallbackContentTypeParsing is 'body'", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("text-plain-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
				fallbackContentTypeParsing: "body",
			});

			const serviceOutput = generator.generateServiceString();

			// getCustom should now use .body()
			expect(serviceOutput).toMatch(/getCustom[\s\S]*?response\.body\(\)/);
		});
	});

	describe("preferredContentTypes interaction", () => {
		it("should respect preferredContentTypes and use correct parse method", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("multi-response-content-types-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
				preferredContentTypes: ["text/plain"],
			});

			const serviceOutput = generator.generateServiceString();

			// When preferring text/plain, should use .text()
			if (serviceOutput.includes("getLegacy")) {
				expect(serviceOutput).toMatch(/getLegacy[\s\S]*?response\.text\(\)/);
			}
		});

		it("should use .json() when preferring application/json", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("multi-response-content-types-api.yaml"),
				output: "output.ts",
				outputClient: "client.ts",
				useOperationId: true,
				preferredContentTypes: ["application/json"],
			});

			const serviceOutput = generator.generateServiceString();

			// Should use response.json() for JSON
			expect(serviceOutput).toContain("response.json()");
		});
	});
});

describe("getResponseParseMethod utility", () => {
	// Import the utility directly for unit testing
	it("should categorize common content types correctly", async () => {
		const { getResponseParseMethod } = await import("@cerios/openapi-to-zod/internal");

		// JSON types
		expect(getResponseParseMethod("application/json")).toEqual({ method: "json", isUnknown: false });
		expect(getResponseParseMethod("text/json")).toEqual({ method: "json", isUnknown: false });
		expect(getResponseParseMethod("application/vnd.api+json")).toEqual({ method: "json", isUnknown: false });
		expect(getResponseParseMethod("application/hal+json")).toEqual({ method: "json", isUnknown: false });

		// Text types
		expect(getResponseParseMethod("text/plain")).toEqual({ method: "text", isUnknown: false });
		expect(getResponseParseMethod("text/html")).toEqual({ method: "text", isUnknown: false });
		expect(getResponseParseMethod("text/css")).toEqual({ method: "text", isUnknown: false });
		expect(getResponseParseMethod("text/csv")).toEqual({ method: "text", isUnknown: false });
		expect(getResponseParseMethod("text/xml")).toEqual({ method: "text", isUnknown: false });
		expect(getResponseParseMethod("application/xml")).toEqual({ method: "text", isUnknown: false });
		expect(getResponseParseMethod("application/javascript")).toEqual({ method: "text", isUnknown: false });
		expect(getResponseParseMethod("image/svg+xml")).toEqual({ method: "text", isUnknown: false });

		// Binary types
		expect(getResponseParseMethod("image/png")).toEqual({ method: "body", isUnknown: false });
		expect(getResponseParseMethod("image/jpeg")).toEqual({ method: "body", isUnknown: false });
		expect(getResponseParseMethod("audio/mpeg")).toEqual({ method: "body", isUnknown: false });
		expect(getResponseParseMethod("video/mp4")).toEqual({ method: "body", isUnknown: false });
		expect(getResponseParseMethod("application/pdf")).toEqual({ method: "body", isUnknown: false });
		expect(getResponseParseMethod("application/zip")).toEqual({ method: "body", isUnknown: false });
		expect(getResponseParseMethod("application/octet-stream")).toEqual({ method: "body", isUnknown: false });
	});

	it("should handle content types with charset parameters", async () => {
		const { getResponseParseMethod } = await import("@cerios/openapi-to-zod/internal");

		expect(getResponseParseMethod("application/json; charset=utf-8")).toEqual({ method: "json", isUnknown: false });
		expect(getResponseParseMethod("text/plain; charset=iso-8859-1")).toEqual({ method: "text", isUnknown: false });
		expect(getResponseParseMethod("text/html; charset=utf-8")).toEqual({ method: "text", isUnknown: false });
	});

	it("should handle unknown content types with fallback", async () => {
		const { getResponseParseMethod } = await import("@cerios/openapi-to-zod/internal");

		// Default fallback is "text"
		expect(getResponseParseMethod("application/x-custom")).toEqual({ method: "text", isUnknown: true });
		expect(getResponseParseMethod("application/x-custom", "text")).toEqual({ method: "text", isUnknown: true });
		expect(getResponseParseMethod("application/x-custom", "json")).toEqual({ method: "json", isUnknown: true });
		expect(getResponseParseMethod("application/x-custom", "body")).toEqual({ method: "body", isUnknown: true });
	});

	it("should handle missing/undefined content types", async () => {
		const { getResponseParseMethod } = await import("@cerios/openapi-to-zod/internal");

		expect(getResponseParseMethod(undefined)).toEqual({ method: "text", isUnknown: true });
		expect(getResponseParseMethod("")).toEqual({ method: "text", isUnknown: true });
		expect(getResponseParseMethod(undefined, "json")).toEqual({ method: "json", isUnknown: true });
	});
});
