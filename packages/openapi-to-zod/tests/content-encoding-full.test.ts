import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";

import { TestUtils } from "./utils/test-utils";

describe("Content Encoding (OpenAPI 3.1)", () => {
	function generateOutput(options: Partial<OpenApiGeneratorOptions> = {}): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("content-encoding-full.yaml"),
			outputTypes: "output.ts",
			...options,
		});
		return generator.generateString();
	}

	it("should generate base64 validation for contentEncoding", () => {
		const output = generateOutput();

		// Should use z.base64() for base64 encoding
		expect(output).toContain("base64ImageSchema");
		expect(output).toContain("z.base64()");
	});

	it("should generate base64url validation", () => {
		const output = generateOutput();

		// Should use z.base64url() for base64url encoding
		expect(output).toContain("base64UrlTokenSchema");
		expect(output).toContain("z.base64url()");
		expect(output).toContain(".min(10)");
		expect(output).toContain(".max(100)");
	});

	it("should generate quoted-printable validation", () => {
		const output = generateOutput();

		// Should have string validation with quoted-printable refinement
		expect(output).toContain("quotedPrintableTextSchema");
		expect(output).toContain("z.string()");
		expect(output).toContain("quoted-printable");
	});

	it("should handle binary encoding", () => {
		const output = generateOutput();

		// Binary should use z.string()
		expect(output).toContain("binaryDataSchema");
		expect(output).toContain("z.string()");
	});

	it("should validate JSON contentMediaType", () => {
		const output = generateOutput();

		// JSON media type should have refinement
		expect(output).toContain("jsonStringSchema");
		expect(output).toContain("JSON.parse");
		expect(output).toContain("Must be valid JSON");
	});

	it("should validate XML contentMediaType", () => {
		const output = generateOutput();

		// XML media type should have refinement
		expect(output).toContain("xmlStringSchema");
		expect(output).toContain("Must be valid XML");
	});

	it("should validate YAML contentMediaType", () => {
		const output = generateOutput();

		// YAML media type should have refinement
		expect(output).toContain("yamlStringSchema");
		expect(output).toContain("Must be valid YAML");
	});

	it("should validate HTML contentMediaType", () => {
		const output = generateOutput();

		// HTML media type should have refinement
		expect(output).toContain("htmlStringSchema");
		expect(output).toContain("Must contain HTML tags");
	});
});
