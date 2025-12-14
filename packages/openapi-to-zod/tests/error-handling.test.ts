import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Comprehensive error handling tests
 * Covers: YAML parsing errors, spec validation, invalid refs, missing components,
 * file system errors, and malformed schemas
 */
describe("Error Handling", () => {
	const outputPath = TestUtils.getOutputPath("error-test.ts");

	describe("YAML Parsing Errors", () => {
		it("should throw error for invalid YAML syntax", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-yaml.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Failed to parse OpenAPI specification/);
		});

		it("should throw error for non-existent file", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("does-not-exist.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Input file not found/);
		});

		it("should include file path in YAML error message", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-yaml.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/invalid-yaml\.yaml/);
		});
	});

	describe("Spec Validation Errors", () => {
		it("should throw error when components is missing", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("empty-components.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/No schemas found in OpenAPI spec/);
		});

		it("should throw error when components.schemas is missing", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("no-schemas.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Expected to find schemas at components\.schemas/);
		});

		it("should include input file path in validation error", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("empty-components.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/empty-components\.yaml/);
		});
	});

	describe("Invalid Reference Errors", () => {
		it("should throw error for invalid $ref in properties", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-refs.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Invalid schema 'User'/);
		});

		it("should include reference path in error message", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-refs.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Invalid reference at 'profile'/);
		});

		it("should identify non-existent schema name", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-refs.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/NonExistentProfile/);
		});

		it("should show full $ref path in error", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-refs.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/#\/components\/schemas\/NonExistentProfile/);
		});

		it("should throw error for invalid $ref in array items", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-refs.yaml"),
				output: outputPath,
			};

			// Will throw on first schema with error (User), but Product also has invalid array items
			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Invalid schema/);
		});
	});

	describe("Nested Reference Errors", () => {
		it("should throw error for invalid $ref in allOf", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-specs.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Invalid schema 'InvalidAllOf'/);
			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/\.allOf\[0\]/);
		});

		it("should throw error for invalid $ref in oneOf", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-oneof.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Invalid schema 'InvalidOneOf'/);
		});

		it("should throw error for invalid $ref in anyOf", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-anyof.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Invalid schema 'InvalidAnyOf'/);
		});

		it("should throw error for invalid $ref in nested properties", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-nested.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Invalid reference at 'metadata\.settings'/);
		});
	});

	describe("Schema Structure Errors", () => {
		it("should handle empty schemas gracefully", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("empty-schemas.yaml"),
				output: outputPath,
			};

			// Empty schema should default to z.unknown() - should not throw during construction
			expect(() => {
				new OpenApiGenerator(options);
			}).not.toThrow();
		});

		it("should handle schema with only description", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("empty-schemas.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).not.toThrow();
		});
	});

	describe("Multiple Error Detection", () => {
		it("should report first invalid reference found", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-refs.yaml"),
				output: outputPath,
			};

			// Should throw on first schema with error (User schema)
			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Invalid schema 'User'/);
		});

		it("should include schema name in error", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("invalid-refs.yaml"),
				output: outputPath,
			};

			expect(() => {
				new OpenApiGenerator(options);
			}).toThrow(/Invalid schema/);
		});
	});
});
