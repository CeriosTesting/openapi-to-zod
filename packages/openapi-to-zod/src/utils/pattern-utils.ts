import { minimatch } from "minimatch";

/**
 * Pattern matching utilities for prefix stripping
 *
 * Shared utility used by core and playwright packages
 *
 * Supports both literal string matching and glob patterns for stripping
 * prefixes from strings (paths, schema names, etc.)
 */

/**
 * Validates if a glob pattern is syntactically valid
 * @param pattern - The glob pattern to validate
 * @returns true if valid, false otherwise
 */
function isValidGlobPattern(pattern: string): boolean {
	try {
		// Try to create a minimatch instance to validate the pattern
		new minimatch.Minimatch(pattern);
		return true;
	} catch {
		return false;
	}
}

/**
 * Checks if a pattern contains glob special characters
 * @param pattern - The pattern to check
 * @returns true if pattern contains glob wildcards
 */
function isGlobPattern(pattern: string): boolean {
	return /[*?[\]{}!]/.test(pattern);
}

/**
 * @shared Strips a prefix from a string using either literal string matching or glob patterns
 * @since 1.1.0
 * Shared utility used by core and playwright packages
 *
 * @param input - The full string to strip from
 * @param pattern - The glob pattern to strip
 * @param ensureLeadingChar - Optional character to ensure at start (e.g., "/" for paths)
 * @returns The string with prefix removed, or original string if no match
 *
 * @example
 * // Literal string matching
 * stripPrefix("/api/v1/users", "/api/v1") // => "/users"
 * stripPrefix("Company.Models.User", "Company.Models.") // => "User"
 *
 * @example
 * // Glob pattern matching
 * stripPrefix("/api/v1.0/users", "/api/v*") // => matches and strips
 * stripPrefix("Company.Models.User", "*.Models.") // => "User"
 * stripPrefix("api_v2_UserSchema", "api_v[0-9]_") // => "UserSchema"
 */
export function stripPrefix(input: string, pattern: string | undefined, ensureLeadingChar?: string): string {
	if (!pattern) {
		return input;
	}

	// Validate glob pattern if it contains special characters
	if (isGlobPattern(pattern) && !isValidGlobPattern(pattern)) {
		console.warn(`⚠️  Invalid glob pattern "${pattern}": Pattern is malformed`);
		return input;
	}

	// Check if pattern contains glob wildcards
	if (isGlobPattern(pattern)) {
		// Use glob matching to find the prefix
		// We need to find what part of the input matches the pattern as a prefix
		// Try matching progressively longer prefixes to find the longest match
		let longestMatch = -1;

		for (let i = 1; i <= input.length; i++) {
			const testPrefix = input.substring(0, i);
			if (minimatch(testPrefix, pattern)) {
				// Found a match - keep looking for a longer match
				longestMatch = i;
			}
		}

		if (longestMatch > 0) {
			// Strip the longest matching prefix
			const stripped = input.substring(longestMatch);

			// Ensure result starts with specified character if provided
			if (ensureLeadingChar) {
				if (stripped === "") {
					return ensureLeadingChar;
				}
				if (!stripped.startsWith(ensureLeadingChar)) {
					return `${ensureLeadingChar}${stripped}`;
				}
			}

			return stripped === "" && !ensureLeadingChar ? input : stripped;
		}

		// No match found
		return input;
	}

	// Literal string matching
	if (input.startsWith(pattern)) {
		const stripped = input.substring(pattern.length);

		// Ensure result starts with specified character if provided
		if (ensureLeadingChar) {
			if (stripped === "") {
				return ensureLeadingChar;
			}
			if (!stripped.startsWith(ensureLeadingChar)) {
				return `${ensureLeadingChar}${stripped}`;
			}
		}

		return stripped;
	}

	// No match - return original input
	return input;
}

/**
 * @shared Strips a prefix from a path (ensures leading slash)
 * @since 1.1.0
 * Shared utility used by playwright package for path manipulation
 *
 * @param path - The full path to strip from
 * @param pattern - The glob pattern to strip
 * @returns The path with prefix removed, or original path if no match
 *
 * @example
 * stripPathPrefix("/api/v1/users", "/api/v1") // => "/users"
 * stripPathPrefix("/api/v2/posts", "/api/v*") // => "/posts"
 * stripPathPrefix("/api/v1.0/items", "/api/v[0-9].*") // => "/items"
 */
export function stripPathPrefix(path: string, pattern: string | undefined): string {
	if (!pattern) {
		return path;
	}

	// For literal string matching with paths, normalize the pattern
	if (!isGlobPattern(pattern)) {
		let normalizedPattern = pattern.trim();
		if (!normalizedPattern.startsWith("/")) {
			normalizedPattern = `/${normalizedPattern}`;
		}
		if (normalizedPattern.endsWith("/") && normalizedPattern !== "/") {
			normalizedPattern = normalizedPattern.slice(0, -1);
		}

		return stripPrefix(path, normalizedPattern, "/");
	}

	// For glob patterns, use as-is
	return stripPrefix(path, pattern, "/");
}
