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

/**
 * Escape JSDoc comment content to prevent injection
 */
export function escapeJSDoc(str: string): string {
	return str.replace(/\*\//g, "*\\/");
}

/**
 * Generate JSDoc comment for an operation (endpoint)
 * Formats operation metadata with proper sanitization
 */
export function generateOperationJSDoc(operation: {
	summary?: string;
	description?: string;
	deprecated?: boolean;
	method: string;
	path: string;
	additionalTags?: string[];
}): string {
	const lines: string[] = [];

	// Add summary as the first line if present
	if (operation.summary && typeof operation.summary === "string") {
		const sanitized = escapeJSDoc(operation.summary).replace(/@/g, "\\@").replace(/\*\//g, "*\\/");
		lines.push(sanitized);
	}

	// Add description if present (separate from summary)
	if (operation.description && typeof operation.description === "string") {
		const sanitized = escapeJSDoc(operation.description).replace(/@/g, "\\@").replace(/\*\//g, "*\\/");
		lines.push(sanitized);
	}

	// Always add method + path info (for documentation and backward compatibility)
	lines.push(`${operation.method} ${operation.path}`);

	// Add deprecated tag
	if (operation.deprecated) {
		lines.push("@deprecated");
	}

	// Add any additional tags (like @returns)
	if (operation.additionalTags && operation.additionalTags.length > 0) {
		lines.push(...operation.additionalTags);
	}

	// Format as JSDoc comment
	if (lines.length === 0) {
		return "";
	}

	// Build multi-line JSDoc
	const formattedLines = lines
		.map((line, index) => {
			if (index === 0) {
				return `\t/**\n\t * ${line}`;
			}
			if (line === "") {
				return "\t *";
			}
			return `\t * ${line}`;
		})
		.join("\n");

	return `${formattedLines}\n\t */`;
}
