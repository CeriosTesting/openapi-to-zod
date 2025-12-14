import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import { TestUtils } from "./utils/test-utils";

describe("Content Media Type Expansion", () => {
	const outputPath = TestUtils.getOutputPath("content-media-type.ts");

	describe("JSON Media Type", () => {
		it("should validate JSON content", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("content-media-type.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { jsonContentSchema } = await import(outputPath);

			// Valid: proper JSON string
			const valid1 = '{"name": "John", "age": 30}';
			expect(() => jsonContentSchema.parse(valid1)).not.toThrow();

			const valid2 = '["a", "b", "c"]';
			expect(() => jsonContentSchema.parse(valid2)).not.toThrow();

			// Invalid: not valid JSON
			const invalid = '{name: "John"}'; // Missing quotes
			expect(() => jsonContentSchema.parse(invalid)).toThrow();
		});
	});

	describe("XML Media Type", () => {
		it("should validate XML content", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("content-media-type.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { xmlContentSchema } = await import(outputPath);

			// Valid: proper XML
			const valid1 = "<root><item>value</item></root>";
			expect(() => xmlContentSchema.parse(valid1)).not.toThrow();

			const valid2 = '<?xml version="1.0"?><note><to>John</to></note>';
			expect(() => xmlContentSchema.parse(valid2)).not.toThrow();

			// Invalid: not XML (no tags)
			const invalid = "just plain text";
			expect(() => xmlContentSchema.parse(invalid)).toThrow();
		});
	});

	describe("YAML Media Type", () => {
		it("should validate YAML content", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("content-media-type.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { yamlContentSchema } = await import(outputPath);

			// Valid: YAML format
			const valid1 = "name: John\nage: 30";
			expect(() => yamlContentSchema.parse(valid1)).not.toThrow();

			const valid2 = "- item1\n- item2\n- item3";
			expect(() => yamlContentSchema.parse(valid2)).not.toThrow();

			// Invalid: empty string
			const invalid = "";
			expect(() => yamlContentSchema.parse(invalid)).toThrow();
		});
	});

	describe("HTML Media Type", () => {
		it("should validate HTML content", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("content-media-type.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { htmlContentSchema } = await import(outputPath);

			// Valid: contains HTML tags
			const valid1 = "<html><body>Hello</body></html>";
			expect(() => htmlContentSchema.parse(valid1)).not.toThrow();

			const valid2 = "<div>Content</div>";
			expect(() => htmlContentSchema.parse(valid2)).not.toThrow();

			// Invalid: no HTML tags
			const invalid = "just plain text";
			expect(() => htmlContentSchema.parse(invalid)).toThrow();
		});
	});

	describe("Plain Text Media Type", () => {
		it("should validate plain text content", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("content-media-type.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { textContentSchema } = await import(outputPath);

			// Valid: any text
			const valid = "This is plain text content";
			expect(() => textContentSchema.parse(valid)).not.toThrow();
		});
	});

	describe("Combined Encoding and Media Type", () => {
		it("should validate base64-encoded XML", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("content-media-type.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { base64XmlSchema } = await import(outputPath);

			// Valid: base64-encoded string
			const valid = "PGRpdj5IZWxsbzwvZGl2Pg=="; // <div>Hello</div>
			expect(() => base64XmlSchema.parse(valid)).not.toThrow();

			// Invalid: not base64
			const invalid = "not base64!@#$";
			expect(() => base64XmlSchema.parse(invalid)).toThrow();
		});

		it("should validate base64-encoded JSON", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("content-media-type.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { base64JsonSchema } = await import(outputPath);

			// Valid: base64-encoded string
			const valid = "eyJuYW1lIjoiSm9obiJ9"; // {"name":"John"}
			expect(() => base64JsonSchema.parse(valid)).not.toThrow();

			// Invalid: not base64
			const invalid = "not base64!@#$";
			expect(() => base64JsonSchema.parse(invalid)).toThrow();
		});
	});

	describe("Multiple Media Types in Object", () => {
		it("should generate schema with multiple media type validations", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("content-media-type.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("Document");
			expect(output).toContain("jsonData");
			expect(output).toContain("xmlData");
			expect(output).toContain("yamlConfig");
			expect(output).toContain("htmlContent");
		});

		it("should validate document with mixed content types", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("content-media-type.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { documentSchema } = await import(outputPath);

			// Valid: all fields have correct format
			const valid = {
				id: "doc_123",
				jsonData: '{"key": "value"}',
				xmlData: "<root>data</root>",
				yamlConfig: "key: value",
				htmlContent: "<p>Hello</p>",
			};
			expect(() => documentSchema.parse(valid)).not.toThrow();

			// Invalid: jsonData is not valid JSON
			const invalid1 = {
				id: "doc_123",
				jsonData: "not json",
				xmlData: "<root>data</root>",
				yamlConfig: "key: value",
				htmlContent: "<p>Hello</p>",
			};
			expect(() => documentSchema.parse(invalid1)).toThrow();

			// Invalid: xmlData has no tags
			const invalid2 = {
				id: "doc_123",
				jsonData: '{"key": "value"}',
				xmlData: "no tags here",
				yamlConfig: "key: value",
				htmlContent: "<p>Hello</p>",
			};
			expect(() => documentSchema.parse(invalid2)).toThrow();
		});
	});
});
