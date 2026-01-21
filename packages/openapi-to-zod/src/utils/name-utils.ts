/**
 * Name conversion utilities
 */

export interface NamingOptions {
	prefix?: string;
	suffix?: string;
}

/**
 * Sanitize a string by replacing invalid identifier characters with underscores
 * Preserves dots, hyphens, underscores, and spaces as word separators
 * Example: "User@Domain" -> "User_Domain"
 * Example: "User-Data@2024" -> "User-Data_2024"
 */
function sanitizeIdentifier(str: string): string {
	// Replace all non-identifier chars (except dots, hyphens, underscores, spaces) with underscores
	// Valid identifier chars: letters, digits, underscore
	// Preserve: dots, hyphens, underscores, spaces as word separators
	return str.replace(/[^a-zA-Z0-9._\-\s]+/g, "_");
}

/**
 * Convert schema name to camelCase with optional prefix/suffix
 * Handles dotted names like "Company.Models.User" -> "companyModelsUser"
 */
export function toCamelCase(str: string, options?: NamingOptions): string {
	// Sanitize invalid characters first
	const sanitized = sanitizeIdentifier(str);

	// Split by dots, hyphens, underscores, and spaces to get words
	const words = sanitized.split(/[.\-_\s]+/).filter(word => word.length > 0);

	// Convert to camelCase: first word lowercase, rest PascalCase
	let name: string;
	if (words.length === 0) {
		name = str.charAt(0).toLowerCase() + str.slice(1);
	} else if (words.length === 1) {
		name = words[0].charAt(0).toLowerCase() + words[0].slice(1);
	} else {
		name =
			words[0].charAt(0).toLowerCase() +
			words[0].slice(1) +
			words
				.slice(1)
				.map(word => word.charAt(0).toUpperCase() + word.slice(1))
				.join("");
	}

	// Add prefix (only lowercase first char for camelCase, preserve rest)
	if (options?.prefix) {
		const prefix = options.prefix.charAt(0).toLowerCase() + options.prefix.slice(1);
		name = prefix + name.charAt(0).toUpperCase() + name.slice(1);
	}

	// Add suffix (capitalize first char for proper camelCase, preserve rest)
	if (options?.suffix) {
		const suffix = options.suffix.charAt(0).toUpperCase() + options.suffix.slice(1);
		name = name + suffix;
	}

	return name;
}

/**
 * @shared Convert enum value to PascalCase and sanitize for TypeScript enum keys
 * @since 1.0.0
 * Utility used by core and playwright packages
 * Handles dotted names like "Company.Models.User" -> "CompanyModelsUser"
 */
export function toPascalCase(str: string | number): string {
	const stringValue = String(str);

	// Check if it's already a valid PascalCase or camelCase identifier
	// (only contains letters, digits, and no special characters)
	const isAlreadyValidCase = /^[a-zA-Z][a-zA-Z0-9]*$/.test(stringValue);

	if (isAlreadyValidCase) {
		// Just ensure it starts with uppercase
		return stringValue.charAt(0).toUpperCase() + stringValue.slice(1);
	}

	// Sanitize invalid characters first
	const sanitized = sanitizeIdentifier(stringValue);

	// Split by dots, hyphens, underscores, and spaces to get words
	const words = sanitized.split(/[.\-_\s]+/).filter(word => word.length > 0);

	// Convert all words to PascalCase
	let result: string;
	if (words.length === 0) {
		result = "Value";
	} else {
		result = words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("");
	}

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

/**
 * Resolve $ref to schema name
 */
export function resolveRef(ref: string): string {
	const parts = ref.split("/");
	return parts[parts.length - 1];
}
