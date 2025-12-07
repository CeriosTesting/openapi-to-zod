import { afterEach, describe, expect, it } from "vitest";
import { cleanupTestOutput, generateFromFixture } from "./utils/test-utils";

describe("Nested WriteOnly/ReadOnly Filtering", () => {
	const outputPath = "tests/output/nested-writeonly.ts";

	afterEach(cleanupTestOutput(outputPath));

	it("should filter nested writeOnly properties in response schemas", () => {
		const output = generateFromFixture({
			fixture: "nested-writeonly.yaml",
			outputPath,
			schemaType: "response",
		});

		// Response schema should not include writeOnly properties
		expect(output).toContain("userSchema");
		expect(output).not.toContain("password:");
		expect(output).not.toContain("apiKey:");

		// But should include readOnly properties
		expect(output).toContain("userId:");
		expect(output).toContain("hash:");
		expect(output).toContain("internalId:");
	});

	it("should filter nested readOnly properties in request schemas", () => {
		const output = generateFromFixture({
			fixture: "nested-writeonly.yaml",
			outputPath,
			schemaType: "request",
		});

		// Request schema should not include readOnly properties
		expect(output).toContain("userSchema");
		expect(output).not.toContain("userId:");
		expect(output).not.toContain("hash:");
		expect(output).not.toContain("internalId:");

		// But should include writeOnly properties
		expect(output).toContain("password:");
		expect(output).toContain("apiKey:");
	});

	it("should filter writeOnly in nested arrays", () => {
		const output = generateFromFixture({
			fixture: "nested-writeonly.yaml",
			outputPath,
			schemaType: "response",
		});

		// Array items should have writeOnly filtered
		expect(output).toContain("nestedArraySchema");
		expect(output).toContain("items:");
		expect(output).not.toContain("secret:");
		expect(output).toContain("generated:");
	});

	it("should filter properties in composition schemas", () => {
		const output = generateFromFixture({
			fixture: "nested-writeonly.yaml",
			outputPath,
			schemaType: "response",
		});

		// allOf with nested object should have writeOnly filtered
		expect(output).toContain("compositionNestedSchema");
		expect(output).toContain("public:");
		expect(output).toContain("visible:");
		expect(output).not.toContain("hidden:");
	});

	it("should include all properties in 'all' schema type", () => {
		const output = generateFromFixture({
			fixture: "nested-writeonly.yaml",
			outputPath,
			schemaType: "all",
		});

		// All schema type should include both readOnly and writeOnly
		expect(output).toContain("userSchema");
		expect(output).toContain("userId:");
		expect(output).toContain("password:");
		expect(output).toContain("hash:");
		expect(output).toContain("internalId:");
		expect(output).toContain("apiKey:");
	});

	it("should handle deeply nested structures", () => {
		const output = generateFromFixture({
			fixture: "nested-writeonly.yaml",
			outputPath,
			schemaType: "response",
		});

		// Nested object within object should filter correctly
		expect(output).toContain("credentials:");
		expect(output).toContain("username:");
		expect(output).not.toContain("password:");
		expect(output).toContain("hash:");
	});
});
