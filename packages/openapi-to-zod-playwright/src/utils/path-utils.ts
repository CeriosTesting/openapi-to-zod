/**
 * Utility functions for path manipulation and prefix stripping
 */

/**
 * Detects if a string pattern should be treated as a regex
 * Checks for common regex indicators:
 * - Starts with ^ (anchor)
 * - Contains \d, \w, \s (character classes)
 * - Contains .* or .+ (quantifiers)
 * - Contains [], (), {} (groups/classes)
 * - Contains +, ?, * as quantifiers (not in paths)
 */
function isRegexPattern(pattern: string): boolean {
	// Check for regex anchors
	if (pattern.startsWith("^") || pattern.endsWith("$")) {
		return true;
	}

	// Check for escaped character classes
	if (/\\[dDwWsS]/.test(pattern)) {
		return true;
	}

	// Check for quantifiers and wildcards
	if (/\.\*|\.\+/.test(pattern)) {
		return true;
	}

	// Check for character classes and groups
	if (/[[\]()]/.test(pattern)) {
		return true;
	}

	// Check for quantifiers in regex context (not path segments)
	// This is tricky - /api/v1+ could be a path or regex
	// We'll be conservative and only flag if it looks like regex
	if (/[^/][+?*]\{/.test(pattern)) {
		return true;
	}

	return false;
}

/**
 * Converts a string pattern to a RegExp if it looks like a regex
 * Otherwise treats it as a literal string prefix
 * @param pattern - The pattern (string or RegExp)
 * @returns A RegExp object or null for literal string matching
 */
function patternToRegex(pattern: string | RegExp): RegExp | null {
	if (pattern instanceof RegExp) {
		return pattern;
	}

	if (isRegexPattern(pattern)) {
		try {
			return new RegExp(pattern);
		} catch (error) {
			console.warn(`⚠️  Invalid regex pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	// Literal string - return null to indicate literal matching
	return null;
}

/**
 * Strips a prefix from a path using either literal string matching or regex
 * @param path - The full path to strip from
 * @param pattern - The pattern to strip (string or RegExp)
 * @returns The path with prefix removed, or original path if no match
 */
export function stripPathPrefix(path: string, pattern: string | RegExp | undefined): string {
	if (!pattern) {
		return path;
	}

	const regex = patternToRegex(pattern);

	if (regex) {
		// Regex matching
		const match = path.match(regex);
		if (match && match.index === 0) {
			// Remove the matched prefix
			const stripped = path.substring(match[0].length);

			// Ensure result starts with / (unless it's empty)
			if (stripped === "") {
				return "/";
			}

			if (!stripped.startsWith("/")) {
				return `/${stripped}`;
			}

			return stripped;
		}
	} else {
		// Literal string matching
		const stringPattern = pattern as string;

		// Normalize pattern - ensure leading slash, remove trailing slash
		let normalizedPattern = stringPattern.trim();
		if (!normalizedPattern.startsWith("/")) {
			normalizedPattern = `/${normalizedPattern}`;
		}
		if (normalizedPattern.endsWith("/") && normalizedPattern !== "/") {
			normalizedPattern = normalizedPattern.slice(0, -1);
		}

		// Check if path starts with the pattern
		if (path.startsWith(normalizedPattern)) {
			const stripped = path.substring(normalizedPattern.length);

			// Ensure result starts with / (unless it's empty)
			if (stripped === "") {
				return "/";
			}

			if (!stripped.startsWith("/")) {
				return `/${stripped}`;
			}

			return stripped;
		}
	}

	// No match - return original path
	return path;
}
