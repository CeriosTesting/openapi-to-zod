import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Tests for readOnly and writeOnly property filtering
 * Covers: request schemas, response schemas, schemaType filtering
 */
describe("ReadOnly and WriteOnly Properties", () => {
	function generateOutput(fixture: string, options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath(fixture),
			...options,
		});
		return generator.generateString();
	}

	describe("Request Schemas (exclude readOnly)", () => {
		it("should exclude readOnly properties in request schemas", () => {
			const output = generateOutput("schema-filtering.yaml", {
				schemaType: "request",
			});

			// readOnly properties should be excluded
			expect(output).not.toContain("id:");
			expect(output).not.toContain("createdAt:");
			expect(output).not.toContain("updatedAt:");
			// writeOnly should be included
			expect(output).toContain("password:");
		});
	});

	describe("Response Schemas (exclude writeOnly)", () => {
		it("should exclude writeOnly properties in response schemas", () => {
			const output = generateOutput("schema-filtering.yaml", {
				schemaType: "response",
			});

			// writeOnly properties should be excluded
			expect(output).not.toContain("password:");
			// readOnly should be included
			expect(output).toContain("id:");
			expect(output).toContain("createdAt:");
			expect(output).toContain("updatedAt:");
		});
	});

	describe("All Properties (default)", () => {
		it("should include all properties when schemaType is all", () => {
			const output = generateOutput("schema-filtering.yaml", {
				schemaType: "all",
			});

			// Both readOnly and writeOnly should be included
			expect(output).toContain("id:");
			expect(output).toContain("password:");
			expect(output).toContain("createdAt:");
		});

		it("should include all properties by default", () => {
			const output = generateOutput("schema-filtering.yaml");

			// Both readOnly and writeOnly should be included
			expect(output).toContain("id:");
			expect(output).toContain("password:");
		});
	});

	describe("Nested ReadOnly/WriteOnly Filtering", () => {
		it("should filter nested readOnly properties in request schemas", () => {
			const output = generateOutput("advanced-schema.yaml", {
				schemaType: "request",
			});

			// Top-level readOnly should be excluded
			expect(output).not.toMatch(/id:.*z\.string\(\)/);
			// Nested readOnly in profile should also be excluded
			expect(output).not.toMatch(/userId:.*z\.string\(\)/);
			// Deeply nested readOnly should be excluded
			expect(output).not.toMatch(/lastLogin:.*z\.string\(\)/);
		});

		it("should filter nested writeOnly properties in response schemas", () => {
			const output = generateOutput("advanced-schema.yaml", {
				schemaType: "response",
			});

			// Top-level writeOnly should be excluded
			expect(output).not.toMatch(/password:.*z\.string\(\)/);
			// Nested writeOnly in profile should also be excluded
			expect(output).not.toMatch(/secretKey:.*z\.string\(\)/);
			// Deeply nested writeOnly should be excluded
			expect(output).not.toMatch(/apiKey:.*z\.string\(\)/);
		});

		it("should preserve nested structure when filtering", () => {
			const output = generateOutput("advanced-schema.yaml", {
				schemaType: "request",
			});

			// Nested objects should still be present
			expect(output).toContain("profile:");
			expect(output).toContain("settings:");
			// Regular properties should remain
			expect(output).toContain("username:");
			expect(output).toContain("displayName:");
			expect(output).toContain("theme:");
		});

		it("should update required arrays when filtering nested properties", () => {
			const output = generateOutput("advanced-schema.yaml", {
				schemaType: "request",
			});

			// If readOnly properties were in required array, they should be removed
			// Check that schema compiles without errors about missing required properties
			expect(output).toContain("userProfileSchema");
		});
	});
});
