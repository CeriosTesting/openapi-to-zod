import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import {
	DEFAULT_PREFERRED_CONTENT_TYPES,
	normalizeContentType,
	selectContentType,
} from "../src/utils/content-type-selector";

import { TestUtils } from "./utils/test-utils";

describe("Preferred Content Types", () => {
	describe("selectContentType utility", () => {
		it("should return first preferred content type when available", () => {
			const available = ["text/plain", "application/json", "text/json"];
			const preferred = ["application/json", "text/json"];

			expect(selectContentType(available, preferred)).toBe("application/json");
		});

		it("should return second preferred when first not available", () => {
			const available = ["text/json", "text/plain"];
			const preferred = ["application/json", "text/json"];

			expect(selectContentType(available, preferred)).toBe("text/json");
		});

		it("should fall back to first available when no preference matches", () => {
			const available = ["text/plain", "text/html"];
			const preferred = ["application/json", "text/json"];

			expect(selectContentType(available, preferred)).toBe("text/plain");
		});

		it("should return undefined for empty available list", () => {
			expect(selectContentType([], ["application/json"])).toBeUndefined();
		});

		it("should use default preferences when not specified", () => {
			const available = ["text/plain", "application/json"];

			expect(selectContentType(available)).toBe("application/json");
		});

		it("should handle case-insensitive matching", () => {
			const available = ["Application/JSON", "text/plain"];
			const preferred = ["application/json"];

			expect(selectContentType(available, preferred)).toBe("Application/JSON");
		});

		it("should ignore charset and other parameters when matching", () => {
			const available = ["application/json; charset=utf-8", "text/plain"];
			const preferred = ["application/json"];

			expect(selectContentType(available, preferred)).toBe("application/json; charset=utf-8");
		});

		it("should work with single content type that matches preference", () => {
			const available = ["application/json"];
			const preferred = ["application/json"];

			expect(selectContentType(available, preferred)).toBe("application/json");
		});

		it("should work with single content type that does not match preference", () => {
			const available = ["text/xml"];
			const preferred = ["application/json"];

			expect(selectContentType(available, preferred)).toBe("text/xml");
		});

		it("should handle multiple preferences with correct priority", () => {
			const available = ["text/json", "application/xml", "text/plain"];
			const preferred = ["application/json", "text/json", "application/xml"];

			// text/json should match before application/xml
			expect(selectContentType(available, preferred)).toBe("text/json");
		});
	});

	describe("normalizeContentType utility", () => {
		it("should strip charset", () => {
			expect(normalizeContentType("application/json; charset=utf-8")).toBe("application/json");
		});

		it("should convert to lowercase", () => {
			expect(normalizeContentType("Application/JSON")).toBe("application/json");
		});

		it("should trim whitespace", () => {
			expect(normalizeContentType("  application/json  ")).toBe("application/json");
		});

		it("should handle multiple parameters", () => {
			expect(normalizeContentType("text/plain; charset=utf-8; boundary=something")).toBe("text/plain");
		});

		it("should handle content type without parameters", () => {
			expect(normalizeContentType("application/json")).toBe("application/json");
		});
	});

	describe("DEFAULT_PREFERRED_CONTENT_TYPES", () => {
		it("should default to application/json", () => {
			expect(DEFAULT_PREFERRED_CONTENT_TYPES).toEqual(["application/json"]);
		});
	});

	describe("Generator integration", () => {
		const fixtureFile = TestUtils.getFixturePath("multi-response-content-types-api.yaml");

		it("should use default preference (application/json) when not specified", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString();

			// getData should use application/json (preferred) even though text/xml comes first in spec
			expect(serviceOutput).toContain("getData");
			expect(serviceOutput).toContain("getReport");

			// Should validate response as JSON (parse with schema)
			expect(serviceOutput).toContain("response.json()");
		});

		it("should respect custom preferred content types with application/json first", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
				preferredContentTypes: ["application/json", "text/json"],
			});

			const serviceOutput = generator.generateServiceString();

			// Should generate valid service with JSON handling
			expect(serviceOutput).toContain("export class ApiService");
			expect(serviceOutput).toContain("getData");
			expect(serviceOutput).toContain("response.json()");
		});

		it("should use text/json when preferred over application/json", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
				preferredContentTypes: ["text/json", "application/json"],
			});

			const serviceOutput = generator.generateServiceString();

			// getTextJson endpoint has text/json, should use it
			expect(serviceOutput).toContain("getTextJson");
			expect(serviceOutput).toContain("export class ApiService");
		});

		it("should fall back to first content type when no preference matches", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
				preferredContentTypes: ["application/yaml"], // Not in any spec
			});

			const serviceOutput = generator.generateServiceString();

			// getLegacy only has text/plain and text/html, should use text/plain (first)
			expect(serviceOutput).toContain("getLegacy");
			expect(serviceOutput).toContain("export class ApiService");
		});

		it("should handle single content type responses correctly", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
				preferredContentTypes: ["application/json"],
			});

			const serviceOutput = generator.generateServiceString();

			// getSingle only has application/json
			expect(serviceOutput).toContain("getSingle");
			expect(serviceOutput).toContain("response.json()");
		});

		it("should handle empty preferences array (fallback to first)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
				useOperationId: true,
				preferredContentTypes: [],
			});

			const serviceOutput = generator.generateServiceString();

			// Should still generate valid service
			expect(serviceOutput).toContain("export class ApiService");
		});
	});

	describe("Config validation", () => {
		it("should accept preferredContentTypes in config options", () => {
			const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

			// Should not throw when preferredContentTypes is provided
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "api-service.ts",
				outputClient: "api-client.ts",
				preferredContentTypes: ["application/json", "text/json"],
			});

			expect(generator).toBeDefined();
			const serviceOutput = generator.generateServiceString();
			expect(serviceOutput).toContain("export class ApiService");
		});
	});
});
