/**
 * Base error class for all Playwright generator errors
 * Provides consistent error handling and structure
 */
export class OpenApiPlaywrightGeneratorError extends Error {
	constructor(
		message: string,
		public readonly cause?: Error
	) {
		super(message);
		this.name = "OpenApiPlaywrightGeneratorError";
		// Maintain proper stack trace for where error was thrown (V8 only)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

/**
 * Thrown when OpenAPI spec parsing or validation fails
 */
export class SpecValidationError extends OpenApiPlaywrightGeneratorError {
	constructor(
		message: string,
		public readonly specPath: string,
		cause?: Error
	) {
		super(message, cause);
		this.name = "SpecValidationError";
	}
}

/**
 * Thrown when file operations fail (read/write/access)
 */
export class FileOperationError extends OpenApiPlaywrightGeneratorError {
	constructor(
		message: string,
		public readonly filePath: string,
		cause?: Error
	) {
		super(message, cause);
		this.name = "FileOperationError";
	}
}

/**
 * Thrown when config file validation fails
 */
export class ConfigValidationError extends OpenApiPlaywrightGeneratorError {
	constructor(
		message: string,
		public readonly configPath?: string,
		cause?: Error
	) {
		super(message, cause);
		this.name = "ConfigValidationError";
	}
}

/**
 * Thrown when client/service generation fails
 */
export class ClientGenerationError extends OpenApiPlaywrightGeneratorError {
	constructor(message: string, cause?: Error) {
		super(message, cause);
		this.name = "ClientGenerationError";
	}
}

/**
 * Thrown when circular reference is detected in schema
 */
export class CircularReferenceError extends OpenApiPlaywrightGeneratorError {
	constructor(
		public readonly schemaName: string,
		public readonly referencePath: string[]
	) {
		const pathStr = referencePath.join(" -> ");
		super(`Circular reference detected in schema '${schemaName}': ${pathStr}`);
		this.name = "CircularReferenceError";
	}
}

/**
 * Thrown when CLI options validation fails
 */
export class CliOptionsError extends OpenApiPlaywrightGeneratorError {
	constructor(message: string, cause?: Error) {
		super(message, cause);
		this.name = "CliOptionsError";
	}
}

/**
 * Thrown when configuration is invalid or missing required values
 */
export class ConfigurationError extends OpenApiPlaywrightGeneratorError {
	constructor(
		message: string,
		public readonly context?: Record<string, unknown>,
		cause?: Error
	) {
		super(message, cause);
		this.name = "ConfigurationError";
	}
}
