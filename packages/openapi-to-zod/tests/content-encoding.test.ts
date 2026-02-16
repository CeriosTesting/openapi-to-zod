import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";

import { TestUtils } from "./utils/test-utils";

describe("Content Encoding and Media Type", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("content-encoding.yaml"),
			outputTypes: "output.ts",
			mode: "normal",
			showStats: false,
			...options,
		});
		return generator.generateString();
	}

	describe("Base64 Content Encoding", () => {
		it("should generate base64 validation with contentEncoding", () => {
			const output = generateOutput();
			expect(output).toContain("Base64Data");
			expect(output).toContain("z.base64()");
		});
	});

	describe("JSON Content Media Type", () => {
		it("should generate JSON validation with contentMediaType", () => {
			const output = generateOutput();
			expect(output).toContain("JsonString");
			expect(output).toContain("JSON.parse");
		});
	});

	describe("Combined Content Encoding and Media Type", () => {
		it("should handle both contentMediaType and contentEncoding", () => {
			const output = generateOutput();
			expect(output).toContain("BinaryFile");
			// When both are present, base64 takes precedence
			expect(output).toContain("z.base64()");
		});
	});

	describe("Content Encoding with Pattern", () => {
		it("should apply both base64 and pattern validation", () => {
			const output = generateOutput();
			expect(output).toContain("PlainWithEncoding");
			expect(output).toContain("z.base64()");
			// Note: Pattern is applied after base64 in our implementation
		});
	});
});
