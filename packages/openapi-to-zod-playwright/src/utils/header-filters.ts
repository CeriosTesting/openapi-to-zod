import { minimatch } from "minimatch";

/**
 * Check if a header should be ignored based on filter patterns
 * Supports glob patterns and case-insensitive matching (HTTP header semantics)
 *
 * @param headerName - The header name to check (e.g., "Authorization", "X-API-Key")
 * @param ignorePatterns - Array of patterns to match against (supports glob patterns)
 * @returns true if the header should be ignored, false otherwise
 */
export function shouldIgnoreHeader(headerName: string, ignorePatterns?: string[]): boolean {
	if (!ignorePatterns || ignorePatterns.length === 0) {
		return false; // No patterns = don't ignore anything
	}

	// Wildcard pattern - ignore all headers
	if (ignorePatterns.includes("*")) {
		return true;
	}

	// Case-insensitive matching (HTTP header standard)
	const headerLower = headerName.toLowerCase();

	return ignorePatterns.some(pattern => {
		const patternLower = pattern.toLowerCase();
		// Use minimatch for glob pattern support
		return minimatch(headerLower, patternLower);
	});
}

/**
 * Filter header parameters based on ignore patterns
 * Returns only headers that should NOT be ignored
 *
 * @param headers - Array of header parameter objects with 'name' property
 * @param ignorePatterns - Array of patterns to match against
 * @returns Filtered array excluding ignored headers
 */
export function filterHeaders<T extends { name: string }>(headers: T[], ignorePatterns?: string[]): T[] {
	if (!ignorePatterns || ignorePatterns.length === 0) {
		return headers; // No filtering
	}

	return headers.filter(header => !shouldIgnoreHeader(header.name, ignorePatterns));
}

/**
 * Collect all unique header names from OpenAPI spec operations
 * Used for validation and warnings
 *
 * @param spec - OpenAPI specification
 * @returns Set of all header parameter names found in the spec (lowercase)
 */
export function collectAllHeaderNames(spec: any): Set<string> {
	const headerNames = new Set<string>();

	if (!spec.paths) {
		return headerNames;
	}

	for (const pathItem of Object.values(spec.paths)) {
		if (!pathItem || typeof pathItem !== "object") continue;

		const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

		for (const method of methods) {
			const operation = (pathItem as any)[method];
			if (!operation?.parameters || !Array.isArray(operation.parameters)) continue;

			for (const param of operation.parameters) {
				if (param && typeof param === "object" && param.in === "header" && param.name) {
					headerNames.add(param.name.toLowerCase());
				}
			}
		}
	}

	return headerNames;
}

/**
 * Validate ignore patterns and warn about patterns that don't match any headers
 * Helps catch typos and configuration mistakes
 *
 * @param ignorePatterns - Patterns to validate
 * @param spec - OpenAPI specification
 */
export function validateIgnorePatterns(ignorePatterns: string[] | undefined, spec: any): void {
	if (!ignorePatterns || ignorePatterns.length === 0) {
		return; // Nothing to validate
	}

	// Wildcard matches everything, no need to validate
	if (ignorePatterns.includes("*")) {
		return;
	}

	const allHeaders = collectAllHeaderNames(spec);

	if (allHeaders.size === 0) {
		// No headers in spec
		console.warn(
			`[openapi-to-zod-playwright] Warning: ignoreHeaders specified but no header parameters found in spec. ` +
				`Patterns will have no effect: ${ignorePatterns.join(", ")}`
		);
		return;
	}

	// Check each pattern
	for (const pattern of ignorePatterns) {
		const patternLower = pattern.toLowerCase();
		let matched = false;

		// Check if pattern matches any header
		for (const headerName of allHeaders) {
			if (minimatch(headerName, patternLower)) {
				matched = true;
				break;
			}
		}

		if (!matched) {
			console.warn(
				`[openapi-to-zod-playwright] Warning: ignoreHeaders pattern "${pattern}" ` +
					`does not match any header parameters in the spec. ` +
					`Available headers: ${Array.from(allHeaders).join(", ")}`
			);
		}
	}
}
