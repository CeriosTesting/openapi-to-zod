/**
 * String utility functions for formatting
 */

/**
 * Convert string to PascalCase (handles kebab-case, snake_case, camelCase)
 * Preserves capitalization in non-delimited strings (camelCase/PascalCase)
 * Examples:
 *   "my-api-client" -> "MyApiClient"
 *   "user_name" -> "UserName"
 *   "userAPI" -> "UserAPI" (preserves existing caps)
 *   "XMLParser" -> "XMLParser" (preserves existing caps)
 */
export function toPascalCase(str: string | number): string {
	const stringValue = String(str);

	// Check if string has delimiters (kebab-case, snake_case, spaces, etc.)
	if (/[-_\s.]+/.test(stringValue)) {
		// Replace all non-identifier chars with underscore for consistency
		const normalized = stringValue.replace(/[^a-zA-Z0-9_]+/g, "_");

		let result = normalized
			.split(/[-_]+/)
			.filter(word => word.length > 0)
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join("");

		// Enum keys can't start with a number - prefix with 'N'
		if (/^\d/.test(result)) {
			result = `N${result}`;
		}

		// If result is empty or only underscores, use a default
		if (!result || /^_+$/.test(result)) {
			return "Value";
		}

		return result;
	}

	// For non-delimited strings (camelCase/PascalCase), just ensure first letter is uppercase
	let result = stringValue.charAt(0).toUpperCase() + stringValue.slice(1);

	// Enum keys can't start with a number - prefix with 'N'
	if (/^\d/.test(result)) {
		result = `N${result}`;
	}

	return result || "Value";
}
