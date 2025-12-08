import { describe, expect, it } from "vitest";
import {
	CircularReferenceError,
	CliOptionsError,
	ConfigValidationError,
	FileOperationError,
	GeneratorError,
	SchemaGenerationError,
	SpecValidationError,
} from "../src/errors";

describe("Error Classes", () => {
	describe("GeneratorError", () => {
		it("should create base error with message and code", () => {
			const error = new GeneratorError("Test error", "TEST_ERROR");

			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(GeneratorError);
			expect(error.message).toBe("Test error");
			expect(error.code).toBe("TEST_ERROR");
			expect(error.name).toBe("GeneratorError");
		});

		it("should accept context object", () => {
			const context = { file: "test.yaml", line: 42 };
			const error = new GeneratorError("Test error", "TEST_ERROR", context);

			expect(error.context).toEqual(context);
		});

		it("should have proper stack trace", () => {
			const error = new GeneratorError("Test error", "TEST_ERROR");

			expect(error.stack).toBeTruthy();
			expect(error.stack).toContain("GeneratorError");
		});

		it("should work without context", () => {
			const error = new GeneratorError("Test error", "TEST_ERROR");

			expect(error.context).toBeUndefined();
		});
	});

	describe("SpecValidationError", () => {
		it("should create spec validation error", () => {
			const error = new SpecValidationError("Invalid spec");

			expect(error).toBeInstanceOf(GeneratorError);
			expect(error).toBeInstanceOf(SpecValidationError);
			expect(error.message).toBe("Invalid spec");
			expect(error.code).toBe("SPEC_VALIDATION_ERROR");
			expect(error.name).toBe("SpecValidationError");
		});

		it("should include context in error", () => {
			const context = { specPath: "/path/to/spec.yaml" };
			const error = new SpecValidationError("Invalid spec", context);

			expect(error.context).toEqual(context);
		});
	});

	describe("FileOperationError", () => {
		it("should create file operation error with file path", () => {
			const error = new FileOperationError("Cannot read file", "/path/to/file.yaml");

			expect(error).toBeInstanceOf(GeneratorError);
			expect(error).toBeInstanceOf(FileOperationError);
			expect(error.message).toBe("Cannot read file");
			expect(error.filePath).toBe("/path/to/file.yaml");
			expect(error.code).toBe("FILE_OPERATION_ERROR");
			expect(error.name).toBe("FileOperationError");
		});

		it("should include file path in context", () => {
			const error = new FileOperationError("Cannot read file", "/path/to/file.yaml");

			expect(error.context?.filePath).toBe("/path/to/file.yaml");
		});

		it("should accept additional context", () => {
			const error = new FileOperationError("Cannot read file", "/path/to/file.yaml", {
				operation: "read",
				permissions: "0644",
			});

			expect(error.context?.operation).toBe("read");
			expect(error.context?.permissions).toBe("0644");
			expect(error.context?.filePath).toBe("/path/to/file.yaml");
		});
	});

	describe("ConfigValidationError", () => {
		it("should create config validation error", () => {
			const error = new ConfigValidationError("Invalid config");

			expect(error).toBeInstanceOf(GeneratorError);
			expect(error).toBeInstanceOf(ConfigValidationError);
			expect(error.message).toBe("Invalid config");
			expect(error.code).toBe("CONFIG_VALIDATION_ERROR");
			expect(error.name).toBe("ConfigValidationError");
		});

		it("should accept optional config path", () => {
			const error = new ConfigValidationError("Invalid config", "/path/to/config.json");

			expect(error.configPath).toBe("/path/to/config.json");
			expect(error.context?.configPath).toBe("/path/to/config.json");
		});

		it("should work without config path", () => {
			const error = new ConfigValidationError("Invalid config");

			expect(error.configPath).toBeUndefined();
		});
	});

	describe("SchemaGenerationError", () => {
		it("should create schema generation error with schema name", () => {
			const error = new SchemaGenerationError("Failed to generate schema", "UserSchema");

			expect(error).toBeInstanceOf(GeneratorError);
			expect(error).toBeInstanceOf(SchemaGenerationError);
			expect(error.message).toBe("Failed to generate schema");
			expect(error.schemaName).toBe("UserSchema");
			expect(error.code).toBe("SCHEMA_GENERATION_ERROR");
			expect(error.name).toBe("SchemaGenerationError");
		});

		it("should include schema name in context", () => {
			const error = new SchemaGenerationError("Failed to generate schema", "UserSchema");

			expect(error.context?.schemaName).toBe("UserSchema");
		});

		it("should accept additional context", () => {
			const error = new SchemaGenerationError("Failed to generate schema", "UserSchema", {
				reason: "circular reference",
				depth: 5,
			});

			expect(error.context?.reason).toBe("circular reference");
			expect(error.context?.depth).toBe(5);
		});
	});

	describe("CircularReferenceError", () => {
		it("should create circular reference error with path", () => {
			const path = ["User", "Address", "User"];
			const error = new CircularReferenceError("User", path);

			expect(error).toBeInstanceOf(SchemaGenerationError);
			expect(error).toBeInstanceOf(CircularReferenceError);
			expect(error.schemaName).toBe("User");
			expect(error.referencePath).toEqual(path);
			expect(error.name).toBe("CircularReferenceError");
		});

		it("should include path in error message", () => {
			const path = ["User", "Address", "User"];
			const error = new CircularReferenceError("User", path);

			expect(error.message).toContain("User -> Address -> User");
			expect(error.message).toContain("Circular reference");
		});

		it("should include path in context", () => {
			const path = ["User", "Address", "User"];
			const error = new CircularReferenceError("User", path);

			expect(error.context?.referencePath).toEqual(path);
			expect(error.context?.circularPath).toBe("User -> Address -> User");
		});

		it("should handle long circular paths", () => {
			const path = ["A", "B", "C", "D", "E", "A"];
			const error = new CircularReferenceError("A", path);

			expect(error.message).toContain("A -> B -> C -> D -> E -> A");
		});

		it("should handle simple circular reference", () => {
			const path = ["User", "User"];
			const error = new CircularReferenceError("User", path);

			expect(error.message).toContain("User -> User");
		});
	});

	describe("CliOptionsError", () => {
		it("should create CLI options error", () => {
			const error = new CliOptionsError("Invalid CLI option");

			expect(error).toBeInstanceOf(GeneratorError);
			expect(error).toBeInstanceOf(CliOptionsError);
			expect(error.message).toBe("Invalid CLI option");
			expect(error.code).toBe("CLI_OPTIONS_ERROR");
			expect(error.name).toBe("CliOptionsError");
		});

		it("should accept context for validation details", () => {
			const context = {
				option: "--mode",
				value: "invalid",
				expected: ["strict", "normal", "loose"],
			};
			const error = new CliOptionsError("Invalid mode value", context);

			expect(error.context).toEqual(context);
		});
	});

	describe("Error Hierarchy", () => {
		it("should maintain proper inheritance chain", () => {
			const errors = [
				new SpecValidationError("test"),
				new FileOperationError("test", "/path"),
				new ConfigValidationError("test"),
				new SchemaGenerationError("test", "schema"),
				new CircularReferenceError("schema", ["A", "B"]),
				new CliOptionsError("test"),
			];

			for (const error of errors) {
				expect(error).toBeInstanceOf(Error);
				expect(error).toBeInstanceOf(GeneratorError);
			}
		});

		it("should allow instanceof checks for specific error types", () => {
			const fileError = new FileOperationError("test", "/path");
			const configError = new ConfigValidationError("test");

			expect(fileError instanceof FileOperationError).toBe(true);
			expect(fileError instanceof ConfigValidationError).toBe(false);
			expect(configError instanceof ConfigValidationError).toBe(true);
			expect(configError instanceof FileOperationError).toBe(false);
		});

		it("should differentiate CircularReferenceError from SchemaGenerationError", () => {
			const circularError = new CircularReferenceError("Test", ["A", "B", "A"]);
			const schemaError = new SchemaGenerationError("Test", "TestSchema");

			expect(circularError instanceof CircularReferenceError).toBe(true);
			expect(circularError instanceof SchemaGenerationError).toBe(true);
			expect(schemaError instanceof SchemaGenerationError).toBe(true);
			expect(schemaError instanceof CircularReferenceError).toBe(false);
		});
	});

	describe("Error Catching", () => {
		it("should be catchable as GeneratorError", () => {
			try {
				throw new SchemaGenerationError("test", "TestSchema");
			} catch (error) {
				expect(error).toBeInstanceOf(GeneratorError);
				if (error instanceof GeneratorError) {
					expect(error.code).toBe("SCHEMA_GENERATION_ERROR");
				}
			}
		});

		it("should be catchable as specific error type", () => {
			try {
				throw new CircularReferenceError("Test", ["A", "B", "A"]);
			} catch (error) {
				expect(error).toBeInstanceOf(CircularReferenceError);
				if (error instanceof CircularReferenceError) {
					expect(error.referencePath).toEqual(["A", "B", "A"]);
				}
			}
		});

		it("should preserve error information when re-thrown", () => {
			const originalError = new FileOperationError("Cannot read", "/path/to/file", { operation: "read" });

			try {
				throw originalError;
			} catch (error) {
				expect(error).toBe(originalError);
				if (error instanceof FileOperationError) {
					expect(error.filePath).toBe("/path/to/file");
					expect(error.context?.operation).toBe("read");
				}
			}
		});
	});

	describe("Error Messages", () => {
		it("should have descriptive messages", () => {
			const errors = [
				new SpecValidationError("OpenAPI spec is invalid"),
				new FileOperationError("File not found", "/missing.yaml"),
				new ConfigValidationError("Invalid JSON", "/config.json"),
				new SchemaGenerationError("Cannot generate", "User"),
				new CircularReferenceError("User", ["User", "Post", "User"]),
				new CliOptionsError("Unknown flag: --invalid"),
			];

			for (const error of errors) {
				expect(error.message).toBeTruthy();
				expect(error.message.length).toBeGreaterThan(0);
			}
		});
	});
});
