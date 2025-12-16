import { z } from "zod";

/**
 * @shared Format Zod validation errors into user-friendly error messages
 * @since 1.0.0
 * Utility used by core and playwright packages
 *
 * @param error - The Zod validation error
 * @param filepath - Path to the config file that was being validated
 * @param configPath - Optional explicit config path provided by user
 * @param additionalNotes - Optional array of additional notes to append to the error message
 * @returns Formatted error message string
 */
export function formatConfigValidationError(
	error: z.ZodError,
	filepath: string | undefined,
	configPath: string | undefined,
	additionalNotes?: string[]
): string {
	const formattedErrors =
		error.issues
			?.map(err => {
				const path = err.path.length > 0 ? err.path.join(".") : "root";
				return `  - ${path}: ${err.message}`;
			})
			.join("\n") || "Unknown validation error";

	const configSource = filepath || configPath || "config file";
	const lines = [
		`Invalid configuration file at: ${configSource}`,
		"",
		"Validation errors:",
		formattedErrors,
		"",
		"Please check your configuration file and ensure:",
		"  - All required fields are present (specs array with input/output)",
		"  - Field names are spelled correctly (no typos)",
		"  - Values match the expected types (e.g., mode: 'strict' | 'normal' | 'loose')",
		"  - No unknown/extra properties are included",
	];

	if (additionalNotes && additionalNotes.length > 0) {
		lines.push(...additionalNotes.map(note => `  - ${note}`));
	}

	return lines.join("\n");
}
