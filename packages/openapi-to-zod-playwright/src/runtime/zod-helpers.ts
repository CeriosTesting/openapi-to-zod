/**
 * Zod error formatting helpers for generated Playwright services
 * These are imported by generated code at runtime when zodErrorFormat is configured
 */
import { z } from "zod";

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
	return error.issues
		.map(issue => {
			const value = issue.path.reduce<unknown>(
				(acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key as string] : undefined),
				input
			);
			return `✖ ${issue.message} (received: ${JSON.stringify(value)})\n  → at ${formatZodErrorPath(issue.path)}`;
		})
		.join("\n");
}

/**
 * Parse data with Zod schema asynchronously and throw prettified error on failure
 * @param schema - Zod schema to validate against
 * @param data - Data to parse and validate
 * @returns Validated data
 * @throws Error with prettified message if validation fails
 */
export async function parseWithPrettifyError<T>(schema: z.ZodType<T>, data: unknown): Promise<T> {
	const result = await schema.safeParseAsync(data);
	if (!result.success) {
		throw Object.assign(new Error(z.prettifyError(result.error)), { cause: result.error });
	}
	return result.data;
}

/**
 * Parse data with Zod schema asynchronously and throw error with values on failure
 * @param schema - Zod schema to validate against
 * @param data - Data to parse and validate
 * @returns Validated data
 * @throws Error with formatted message including received values if validation fails
 */
export async function parseWithPrettifyErrorWithValues<T>(schema: z.ZodType<T>, data: unknown): Promise<T> {
	const result = await schema.safeParseAsync(data);
	if (!result.success) {
		throw Object.assign(new Error(formatZodErrorWithValues(result.error, data)), { cause: result.error });
	}
	return result.data;
}
