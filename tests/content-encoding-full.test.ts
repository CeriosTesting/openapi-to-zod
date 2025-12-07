import { afterEach, describe, expect, it } from "vitest";
import { cleanupTestOutput, generateFromFixture } from "./utils/test-utils";

describe("Content Encoding (OpenAPI 3.1)", () => {
	const outputPath = "tests/output/content-encoding-full.ts";

	afterEach(cleanupTestOutput(outputPath));

	it("should generate base64 validation for contentEncoding", () => {
		const output = generateFromFixture({
			fixture: "content-encoding-full.yaml",
			outputPath,
		});

		// Should use z.base64() for base64 encoding
		expect(output).toContain("base64ImageSchema");
		expect(output).toContain("z.base64()");
	});

	it("should generate base64url validation", () => {
		const output = generateFromFixture({
			fixture: "content-encoding-full.yaml",
			outputPath,
		});

		// Should use z.base64url() for base64url encoding
		expect(output).toContain("base64UrlTokenSchema");
		expect(output).toContain("z.base64url()");
		expect(output).toContain(".min(10)");
		expect(output).toContain(".max(100)");
	});

	it("should generate quoted-printable validation", () => {
		const output = generateFromFixture({
			fixture: "content-encoding-full.yaml",
			outputPath,
		});

		// Should have string validation with quoted-printable refinement
		expect(output).toContain("quotedPrintableTextSchema");
		expect(output).toContain("z.string()");
		expect(output).toContain("quoted-printable");
	});

	it("should handle binary encoding", () => {
		const output = generateFromFixture({
			fixture: "content-encoding-full.yaml",
			outputPath,
		});

		// Binary should use z.string()
		expect(output).toContain("binaryDataSchema");
		expect(output).toContain("z.string()");
	});

	it("should validate JSON contentMediaType", () => {
		const output = generateFromFixture({
			fixture: "content-encoding-full.yaml",
			outputPath,
		});

		// JSON media type should have refinement
		expect(output).toContain("jsonStringSchema");
		expect(output).toContain("JSON.parse");
		expect(output).toContain("Must be valid JSON");
	});

	it("should validate XML contentMediaType", () => {
		const output = generateFromFixture({
			fixture: "content-encoding-full.yaml",
			outputPath,
		});

		// XML media type should have refinement
		expect(output).toContain("xmlStringSchema");
		expect(output).toContain("Must be valid XML");
	});

	it("should validate YAML contentMediaType", () => {
		const output = generateFromFixture({
			fixture: "content-encoding-full.yaml",
			outputPath,
		});

		// YAML media type should have refinement
		expect(output).toContain("yamlStringSchema");
		expect(output).toContain("Must be valid YAML");
	});

	it("should validate HTML contentMediaType", () => {
		const output = generateFromFixture({
			fixture: "content-encoding-full.yaml",
			outputPath,
		});

		// HTML media type should have refinement
		expect(output).toContain("htmlStringSchema");
		expect(output).toContain("Must contain HTML tags");
	});
});
