/**
 * Name conversion utilities
 */

export interface NamingOptions {
	prefix?: string;
	suffix?: string;
}

/**
 * Convert schema name to camelCase with optional prefix/suffix
 */
export function toCamelCase(str: string, options?: NamingOptions): string {
	let name = str.charAt(0).toLowerCase() + str.slice(1);

	// Add prefix
	if (options?.prefix) {
		const prefix = options.prefix.toLowerCase();
		name = prefix + name.charAt(0).toUpperCase() + name.slice(1);
	}

	// Add suffix before "Schema"
	if (options?.suffix) {
		const suffix = options.suffix;
		name = name + suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase();
	}

	return name;
}

/**
 * @shared Convert enum value to PascalCase and sanitize for TypeScript enum keys
 * @since 1.0.0
 * Utility used by core and playwright packages
 */
export function toPascalCase(str: string | number): string {
	const stringValue = String(str);
	// Replace ALL special characters (not just dots/spaces) with underscores, then convert to PascalCase
	// Valid identifier chars: letters, digits, underscore. Everything else becomes underscore.
	let result = stringValue
		.replace(/[^a-zA-Z0-9_]+/g, "_") // Replace all non-identifier chars with underscore
		.split(/[-_]+/)
		.filter(word => word.length > 0) // Remove empty parts
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");

	// Enum keys can't start with a number - prefix with 'N'
	if (/^\d/.test(result)) {
		result = `N${result}`;
	}

	// If result is empty or only underscores, use a default
	if (!result || /^_+$/.test(result)) {
		result = "Value";
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
