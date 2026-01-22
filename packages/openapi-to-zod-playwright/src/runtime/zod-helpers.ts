/**
 * Zod error formatting helpers for generated Playwright services
 * These are imported by generated code at runtime when zodErrorFormat is configured
 */
import { z } from "zod";

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
	get issues(): z.ZodIssue[] {
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
 * Format Zod error with actual received values for debugging
 * @param error - Zod error object
 * @param input - The original input data that was validated
 * @returns Formatted error message with values
 */
export function formatZodErrorWithValues(error: z.ZodError, input: unknown): string {
	const formattedIssues = error.issues
		.map(issue => {
			const value = issue.path.reduce<unknown>(
				(acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key as string] : undefined),
				input
			);
			// Skip printing received value for objects/arrays (e.g., "Unrecognized key" errors)
			const isObjectOrArray = typeof value === "object" && value !== null;
			const receivedPart = isObjectOrArray ? "" : ` (received: ${JSON.stringify(value)})`;
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
