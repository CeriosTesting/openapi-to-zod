/**
 * Converts an OpenAPI path to a PascalCase method name part
 * Examples:
 *   /users/{userId} -> UsersByUserId
 *   /auth/login -> AuthLogin
 *   /api/v1/organizations/{orgId}/repos/{repoId} -> ApiV1OrganizationsByOrgIdReposByRepoId
 */
export function pathToPascalCase(path: string): string {
	const segments = path.split("/").filter(Boolean); // Remove empty segments

	// Handle root path
	if (segments.length === 0) {
		return "Root";
	}

	return segments
		.map(segment => {
			// Handle path parameters like {userId}
			if (segment.startsWith("{") && segment.endsWith("}")) {
				const paramName = segment.slice(1, -1);
				return `By${capitalize(paramName)}`;
			}
			// Convert regular segments to PascalCase
			return capitalize(segment);
		})
		.join("");
}

/**
 * Generates a method name from HTTP method and path
 * Examples:
 *   GET /users/{userId} -> getUsersByUserId
 *   POST /auth/login -> postAuthLogin
 *   DELETE /organizations/{orgId}/members/{userId} -> deleteOrganizationsByOrgIdMembersByUserId
 */
export function generateMethodName(httpMethod: string, path: string): string {
	const methodPrefix = httpMethod.toLowerCase();
	const pathPart = pathToPascalCase(path);
	return methodPrefix + pathPart;
}

/**
 * Capitalizes the first letter of a string and converts rest to camelCase
 * Handles kebab-case, snake_case, and regular words
 */
function capitalize(str: string): string {
	// Handle kebab-case and snake_case
	if (str.includes("-") || str.includes("_")) {
		return str
			.split(/[-_]/)
			.map((part, index) => {
				if (index === 0) {
					return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
				}
				return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
			})
			.join("");
	}

	// Regular word - just capitalize first letter
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Extracts path parameters from an OpenAPI path
 * Example: /users/{userId}/posts/{postId} -> ['userId', 'postId']
 */
export function extractPathParams(path: string): string[] {
	const params: string[] = [];
	const regex = /\{([^}]+)\}/g;
	let match: RegExpExecArray | null = regex.exec(path);

	while (match !== null) {
		params.push(match[1]);
		match = regex.exec(path);
	}

	return params;
}

/**
 * Converts a path parameter name to TypeScript parameter name
 * Handles special cases and ensures valid identifiers
 */
export function sanitizeParamName(paramName: string): string {
	// First, convert kebab-case and snake_case to camelCase
	const camelCased = paramName
		.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase())
		.replace(/[^a-zA-Z0-9]/g, ""); // Remove remaining special characters

	// Prefix with _ if starts with number
	if (/^[0-9]/.test(camelCased)) {
		return `_${camelCased}`;
	}

	return camelCased;
}
