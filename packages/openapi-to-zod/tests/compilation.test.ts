import { execSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Comprehensive Compilation Tests", () => {
	const outputFiles: string[] = [];

	// Helper to track and generate output
	function generateAndTrack(name: string, options: OpenApiGeneratorOptions): void {
		const outputPath = TestUtils.getOutputPath(`compilation-${name}.ts`);
		outputFiles.push(outputPath);

		const generator = new OpenApiGenerator({
			...options,
			output: outputPath,
		});
		generator.generate();
	}

	// Compile all generated files at once after all tests complete
	afterAll(() => {
		if (outputFiles.length === 0) return;

		const filesArg = outputFiles.join(" ");
		expect(() => {
			execSync(`npx tsc --noEmit --skipLibCheck ${filesArg}`, {
				stdio: "pipe",
			});
		}).not.toThrow();
	}, 30000); // 30 second timeout for batch compilation

	describe("Mode Options", () => {
		it("should generate with mode: strict", () => {
			generateAndTrack("mode-strict", {
				input: TestUtils.getFixturePath("simple.yaml"),
				mode: "strict",
			});
		});

		it("should generate with mode: normal", () => {
			generateAndTrack("mode-normal", {
				input: TestUtils.getFixturePath("simple.yaml"),
				mode: "normal",
			});
		});

		it("should generate with mode: loose", () => {
			generateAndTrack("mode-loose", {
				input: TestUtils.getFixturePath("simple.yaml"),
				mode: "loose",
			});
		});
	});

	describe("TypeMode Options", () => {
		it("should generate with typeMode: inferred", () => {
			generateAndTrack("typemode-inferred", {
				input: TestUtils.getFixturePath("complex.yaml"),
				request: {
					typeMode: "inferred",
				},
			});
		});

		it("should generate with typeMode: native", () => {
			generateAndTrack("typemode-native", {
				input: TestUtils.getFixturePath("complex.yaml"),
				request: {
					typeMode: "native",
				},
			});
		});

		it("should generate with mixed typeMode (request native, response inferred)", () => {
			generateAndTrack("typemode-mixed", {
				input: TestUtils.getFixturePath("type-mode.yaml"),
				request: {
					typeMode: "native",
				},
			});
		});
	});

	describe("Enum Options", () => {
		it("should generate with enumType: zod", () => {
			generateAndTrack("enum-zod", {
				input: TestUtils.getFixturePath("complex.yaml"),
				enumType: "zod",
			});
		});

		it("should generate with enumType: typescript", () => {
			generateAndTrack("enum-typescript", {
				input: TestUtils.getFixturePath("complex.yaml"),
				enumType: "typescript",
				nativeEnumType: "enum",
			});
		});
		it("should generate with nativeEnumType: union (native mode)", () => {
			generateAndTrack("native-enum-union", {
				input: TestUtils.getFixturePath("complex.yaml"),
				request: {
					typeMode: "native",
					nativeEnumType: "union",
				},
			});
		});
		it("should generate with nativeEnumType: enum (native mode)", () => {
			generateAndTrack("native-enum-enum", {
				input: TestUtils.getFixturePath("complex.yaml"),
				request: {
					typeMode: "native",
					nativeEnumType: "enum",
				},
			});
		});
	});

	describe("Description Options", () => {
		it("should generate with includeDescriptions: true", () => {
			generateAndTrack("descriptions-true", {
				input: TestUtils.getFixturePath("documentation.yaml"),
				includeDescriptions: true,
			});
		});

		it("should generate with includeDescriptions: false", () => {
			generateAndTrack("descriptions-false", {
				input: TestUtils.getFixturePath("documentation.yaml"),
				includeDescriptions: false,
			});
		});

		it("should generate with useDescribe: true", () => {
			generateAndTrack("use-describe-true", {
				input: TestUtils.getFixturePath("simple.yaml"),
				useDescribe: true,
			});
		});

		it("should generate with useDescribe: false", () => {
			generateAndTrack("use-describe-false", {
				input: TestUtils.getFixturePath("simple.yaml"),
				useDescribe: false,
			});
		});
	});

	describe("SchemaType Options", () => {
		it("should generate with schemaType: all", () => {
			generateAndTrack("schematype-all", {
				input: TestUtils.getFixturePath("simple.yaml"),
				schemaType: "all",
			});
		});

		it("should generate with schemaType: request", () => {
			generateAndTrack("schematype-request", {
				input: TestUtils.getFixturePath("type-mode.yaml"),
				schemaType: "request",
			});
		});

		it("should generate with schemaType: response", () => {
			generateAndTrack("schematype-response", {
				input: TestUtils.getFixturePath("type-mode.yaml"),
				schemaType: "response",
			});
		});
	});

	describe("Naming Options", () => {
		it("should generate with prefix", () => {
			generateAndTrack("prefix", {
				input: TestUtils.getFixturePath("simple.yaml"),
				prefix: "api",
			});
		});

		it("should generate with suffix", () => {
			generateAndTrack("suffix", {
				input: TestUtils.getFixturePath("simple.yaml"),
				suffix: "dto",
			});
		});

		it("should generate with both prefix and suffix", () => {
			generateAndTrack("prefix-suffix", {
				input: TestUtils.getFixturePath("simple.yaml"),
				prefix: "api",
				suffix: "model",
			});
		});
	});

	describe("Complex Fixtures", () => {
		it("should generate circular references", () => {
			generateAndTrack("circular", {
				input: TestUtils.getFixturePath("circular.yaml"),
			});
		});

		it("should generate composition schemas (allOf, oneOf, anyOf)", () => {
			generateAndTrack("composition", {
				input: TestUtils.getFixturePath("composition.yaml"),
			});
		});

		it("should generate discriminator mappings", () => {
			generateAndTrack("discriminator", {
				input: TestUtils.getFixturePath("discriminator-mapping.yaml"),
			});
		});

		it("should generate pattern properties", () => {
			generateAndTrack("pattern-props", {
				input: TestUtils.getFixturePath("pattern-properties.yaml"),
			});
		});

		it("should generate array contains schemas", () => {
			generateAndTrack("array-contains", {
				input: TestUtils.getFixturePath("array-contains.yaml"),
			});
		});

		it("should generate schema dependencies", () => {
			generateAndTrack("dependencies", {
				input: TestUtils.getFixturePath("dependencies.yaml"),
			});
		});

		it("should generate unevaluated properties", () => {
			generateAndTrack("unevaluated", {
				input: TestUtils.getFixturePath("unevaluated.yaml"),
			});
		});

		it("should generate not keyword schemas", () => {
			generateAndTrack("not-keyword", {
				input: TestUtils.getFixturePath("not-keyword.yaml"),
			});
		});

		it("should generate content encoding schemas", () => {
			generateAndTrack("content-encoding", {
				input: TestUtils.getFixturePath("content-encoding.yaml"),
			});
		});

		it("should generate content media type schemas", () => {
			generateAndTrack("content-media-type", {
				input: TestUtils.getFixturePath("content-media-type.yaml"),
			});
		});

		it("should generate format constraints", () => {
			generateAndTrack("formats", {
				input: TestUtils.getFixturePath("formats.yaml"),
			});
		});

		it("should generate various constraints", () => {
			generateAndTrack("constraints", {
				input: TestUtils.getFixturePath("constraints.yaml"),
			});
		});
	});

	describe("Combined Options", () => {
		it("should generate with all options enabled", () => {
			generateAndTrack("all-options", {
				input: TestUtils.getFixturePath("complex.yaml"),
				mode: "strict",
				enumType: "typescript",
				nativeEnumType: "enum",
				includeDescriptions: true,
				useDescribe: true,
				showStats: true,
				prefix: "api",
				suffix: "dto",
				request: {
					typeMode: "inferred",
				},
			});
		});
		it("should generate with native types and all features", () => {
			generateAndTrack("native-all-features", {
				input: TestUtils.getFixturePath("complex.yaml"),
				mode: "loose",
				includeDescriptions: true,
				showStats: false,
				prefix: "v1",
				suffix: "type",
				request: {
					typeMode: "native",
					nativeEnumType: "enum",
				},
			});
		});

		it("should generate with request/response overrides", () => {
			generateAndTrack("request-response", {
				input: TestUtils.getFixturePath("type-mode.yaml"),
				mode: "normal",
				request: {
					typeMode: "native",
					mode: "strict",
					includeDescriptions: false,
				},
				response: {
					mode: "loose",
					useDescribe: true,
					includeDescriptions: true,
				},
			});
		});
	});

	describe("Edge Cases", () => {
		it("should generate empty schemas (defaulting to z.unknown())", () => {
			generateAndTrack("empty-schemas", {
				input: TestUtils.getFixturePath("empty-schemas.yaml"),
			});
		});

		it("should generate with nested writeOnly properties", () => {
			generateAndTrack("nested-writeonly", {
				input: TestUtils.getFixturePath("nested-writeonly.yaml"),
			});
		});

		it("should generate advanced formats", () => {
			generateAndTrack("advanced-formats", {
				input: TestUtils.getFixturePath("advanced-formats.yaml"),
			});
		});
	});
});
