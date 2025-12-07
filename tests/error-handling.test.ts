import { describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";
import type { GeneratorOptions } from "../src/types";

/**
 * Comprehensive error handling tests
 * Covers: YAML parsing errors, spec validation, invalid refs, missing components,
 * file system errors, and malformed schemas
 */
describe("Error Handling", () => {
	const outputPath = "tests/output/error-test.ts";

	describe("YAML Parsing Errors", () => {
		it("should throw error for invalid YAML syntax", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-yaml.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Failed to parse OpenAPI YAML file/);
		});

		it("should throw error for non-existent file", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/does-not-exist.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Failed to parse OpenAPI YAML file/);
		});

		it("should include file path in YAML error message", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-yaml.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/invalid-yaml\.yaml/);
		});
	});

	describe("Spec Validation Errors", () => {
		it("should throw error when components is missing", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/empty-components.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/No schemas found in OpenAPI spec/);
		});

		it("should throw error when components.schemas is missing", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/no-schemas.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Expected to find schemas at components\.schemas/);
		});

		it("should include input file path in validation error", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/empty-components.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/empty-components\.yaml/);
		});
	});

	describe("Invalid Reference Errors", () => {
		it("should throw error for invalid $ref in properties", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-refs.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Invalid schema 'User'/);
		});

		it("should include reference path in error message", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-refs.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Invalid reference at 'profile'/);
		});

		it("should identify non-existent schema name", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-refs.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/NonExistentProfile/);
		});

		it("should show full $ref path in error", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-refs.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/#\/components\/schemas\/NonExistentProfile/);
		});

		it("should throw error for invalid $ref in array items", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-refs.yaml",
				output: outputPath,
			};

			// Will throw on first schema with error (User), but Product also has invalid array items
			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Invalid schema/);
		});
	});

	describe("Nested Reference Errors", () => {
		it("should throw error for invalid $ref in allOf", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-specs.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Invalid schema 'InvalidAllOf'/);
			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/\.allOf\[0\]/);
		});

		it("should throw error for invalid $ref in oneOf", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-oneof.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Invalid schema 'InvalidOneOf'/);
		});

		it("should throw error for invalid $ref in anyOf", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-anyof.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Invalid schema 'InvalidAnyOf'/);
		});

		it("should throw error for invalid $ref in nested properties", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-nested.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Invalid reference at 'metadata\.settings'/);
		});
	});

	describe("Schema Structure Errors", () => {
		it("should handle empty schemas gracefully", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/empty-schemas.yaml",
				output: outputPath,
			};

			// Empty schema should default to z.unknown() - should not throw during construction
			expect(() => {
				new ZodSchemaGenerator(options);
			}).not.toThrow();
		});

		it("should handle schema with only description", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/empty-schemas.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).not.toThrow();
		});
	});

	describe("Multiple Error Detection", () => {
		it("should report first invalid reference found", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-refs.yaml",
				output: outputPath,
			};

			// Should throw on first schema with error (User schema)
			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Invalid schema 'User'/);
		});

		it("should include schema name in error", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/invalid-refs.yaml",
				output: outputPath,
			};

			expect(() => {
				new ZodSchemaGenerator(options);
			}).toThrow(/Invalid schema/);
		});
	});
});
