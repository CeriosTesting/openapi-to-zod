import { describe, expect, it } from "vitest";

import {
	ConfigurationError,
	ConfigValidationError,
	FileOperationError,
	GeneratorError,
	SpecValidationError,
} from "../src/errors";

describe("errors", () => {
	describe("GeneratorError", () => {
		it("should create error with message and code", () => {
			const error = new GeneratorError("Test error", "TEST_ERROR");
			expect(error.message).toBe("Test error");
			expect(error.code).toBe("TEST_ERROR");
			expect(error.name).toBe("GeneratorError");
		});

		it("should include context when provided", () => {
			const error = new GeneratorError("Test error", "TEST_ERROR", { key: "value" });
			expect(error.context).toEqual({ key: "value" });
		});

		it("should be instanceof Error", () => {
			const error = new GeneratorError("Test", "CODE");
			expect(error).toBeInstanceOf(Error);
		});
	});

	describe("SpecValidationError", () => {
		it("should create with correct code", () => {
			const error = new SpecValidationError("Invalid spec");
			expect(error.code).toBe("SPEC_VALIDATION_ERROR");
			expect(error.name).toBe("SpecValidationError");
		});

		it("should be instanceof GeneratorError", () => {
			const error = new SpecValidationError("Invalid spec");
			expect(error).toBeInstanceOf(GeneratorError);
		});
	});

	describe("FileOperationError", () => {
		it("should create with file path", () => {
			const error = new FileOperationError("File not found", "/path/to/file.yaml");
			expect(error.code).toBe("FILE_OPERATION_ERROR");
			expect(error.name).toBe("FileOperationError");
			expect(error.filePath).toBe("/path/to/file.yaml");
			expect(error.context?.filePath).toBe("/path/to/file.yaml");
		});
	});

	describe("ConfigValidationError", () => {
		it("should create with optional config path", () => {
			const error = new ConfigValidationError("Invalid config", "/path/to/config.json");
			expect(error.code).toBe("CONFIG_VALIDATION_ERROR");
			expect(error.name).toBe("ConfigValidationError");
			expect(error.configPath).toBe("/path/to/config.json");
		});

		it("should work without config path", () => {
			const error = new ConfigValidationError("Invalid config");
			expect(error.configPath).toBeUndefined();
		});
	});

	describe("ConfigurationError", () => {
		it("should create with correct code", () => {
			const error = new ConfigurationError("Missing required field");
			expect(error.code).toBe("CONFIGURATION_ERROR");
			expect(error.name).toBe("ConfigurationError");
		});
	});
});
