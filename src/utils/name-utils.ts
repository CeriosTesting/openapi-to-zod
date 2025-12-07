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
 * Convert enum value to PascalCase and sanitize for TypeScript enum keys
 */
export function toPascalCase(str: string | number): string {
	const stringValue = String(str);
	// Replace dots and other special chars with underscores, then convert to PascalCase
	let result = stringValue
		.replace(/[.\s]+/g, "_")
		.split(/[-_]+/)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");

	// Enum keys can't start with a number - prefix with 'N'
	if (/^\d/.test(result)) {
		result = `N${result}`;
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
