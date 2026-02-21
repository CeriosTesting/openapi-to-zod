/**
 * Zod error formatting helpers for generated Playwright services
 * These are imported by generated code at runtime when zodErrorFormat is configured
 */
import { z } from "zod";

/** Type guard to check if value is a record type */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Type guard to check if value is a string */
function isStringKey(key: unknown): key is string {
	return typeof key === "string";
}

/**
 * Error thrown when Zod schema validation fails at runtime
 * Used by generated Playwright services for request/response validation
 */
export class ZodValidationError extends Error {
	declare readonly cause: z.ZodError;

	constructor(
		message: string,
		/** The original Zod error containing validation issues */
		public readonly zodError: z.ZodError,
		/** The input data that failed validation (only populated for WithValues variant) */
		public readonly input?: unknown
	) {
		super(message);
		this.name = "ZodValidationError";
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/** Access validation issues from the underlying ZodError */
	get issues(): z.core.$ZodIssue[] {
		return this.zodError.issues;
	}
}

/**
 * Format Zod error path for display
 * @param path - Array of property keys representing the error path
 * @returns Formatted path string
 */
export function formatZodErrorPath(path: PropertyKey[]): string {
	return path
		.map((segment, index) => {
			if (typeof segment.valueOf() === "number") {
				return `[${segment.toString()}]`;
			}
			return index === 0 ? segment.toString() : `.${segment.toString()}`;
		})
		.join("");
}

/**
 * Traverse object path to get value, handling both string keys and numeric indices
 * @param input - The root object to traverse
 * @param path - Array of path segments (strings or numbers)
 * @returns The value at the path, or undefined if not found
 */
function getValueAtPath(input: unknown, path: PropertyKey[]): unknown {
	return path.reduce<unknown>((acc, key) => {
		if (Array.isArray(acc) && typeof key === "number") {
			return acc[key];
		}
		if (isRecord(acc) && isStringKey(key)) {
			return acc[key];
		}
		return undefined;
	}, input);
}

/**
 * Determine if we should skip printing the received value
 * @param issue - The Zod issue
 * @param value - The resolved value at the path
 * @returns true if received part should be omitted
 */
function shouldSkipReceivedValue(issue: z.core.$ZodIssue, value: unknown): boolean {
	// Skip for objects/arrays (e.g., parent context for unrecognized key errors)
	if (isRecord(value) || Array.isArray(value)) {
		return true;
	}
	// Skip for unrecognized key errors - the value points to parent, not the invalid key
	if (issue.code === "unrecognized_keys") {
		return true;
	}
	// Skip if the message already mentions "received" to avoid duplication
	if (issue.message.toLowerCase().includes("received")) {
		return true;
	}
	return false;
}

/**
 * Format Zod error with actual received values for debugging
 * @param error - Zod error object
 * @param input - The original input data that was validated
 * @returns Formatted error message with values
 */
export function formatZodErrorWithValues(error: z.ZodError, input: unknown): string {
	const formattedIssues = error.issues
		.map(issue => {
			const value = getValueAtPath(input, issue.path);
			const receivedPart = shouldSkipReceivedValue(issue, value) ? "" : ` (received: ${JSON.stringify(value)})`;
			return `✖ ${issue.message}${receivedPart}\n  → at ${formatZodErrorPath(issue.path)}`;
		})
		.join("\n");
	// Leading newline so first error starts on its own line after "ZodValidationError:"
	return `\n${formattedIssues}`;
}

/**
 * Parse data with Zod schema asynchronously and throw prettified error on failure
 * @param schema - Zod schema to validate against
 * @param data - Data to parse and validate
 * @returns Validated data
 * @throws ZodValidationError with prettified message if validation fails
 */
export async function parseWithPrettifyError<T>(schema: z.ZodType<T>, data: unknown): Promise<T> {
	const result = await schema.safeParseAsync(data);
	if (!result.success) {
		throw new ZodValidationError(z.prettifyError(result.error), result.error);
	}
	return result.data;
}

/**
 * Parse data with Zod schema asynchronously and throw error with values on failure
 * @param schema - Zod schema to validate against
 * @param data - Data to parse and validate
 * @returns Validated data
 * @throws ZodValidationError with formatted message including received values if validation fails
 */
export async function parseWithPrettifyErrorWithValues<T>(schema: z.ZodType<T>, data: unknown): Promise<T> {
	const result = await schema.safeParseAsync(data);
	if (!result.success) {
		throw new ZodValidationError(formatZodErrorWithValues(result.error, data), result.error, data);
	}
	return result.data;
}
