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
 * Handles kebab-case, snake_case, dots, and regular words
 */
function capitalize(str: string): string {
	// Handle kebab-case, snake_case, and dots
	if (str.includes("-") || str.includes("_") || str.includes(".")) {
		return str
			.split(/[-_.]/)
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

/**
 * Sanitizes an operationId to be a valid TypeScript identifier in camelCase
 * Handles kebab-case, snake_case, PascalCase, and other special characters
 * Examples:
 *   "get-users" -> "getUsers"
 *   "create_user" -> "createUser"
 *   "GetUsers" -> "getUsers"
 *   "getUsers" -> "getUsers" (preserved)
 *   "delete-user-by-id" -> "deleteUserById"
 */
export function sanitizeOperationId(operationId: string): string {
	// Check if already a valid identifier (alphanumeric, no special chars except starting with letter)
	const isValidIdentifier = /^[a-zA-Z][a-zA-Z0-9]*$/.test(operationId);

	if (isValidIdentifier) {
		// Already valid - just ensure it starts with lowercase (camelCase)
		return operationId.charAt(0).toLowerCase() + operationId.slice(1);
	}

	// Has special characters - need to transform
	// Replace special characters with spaces for splitting
	const normalized = operationId.replace(/[^a-zA-Z0-9]+/g, " ");

	// Split into words and convert to camelCase
	const words = normalized
		.trim()
		.split(/\s+/)
		.filter(word => word.length > 0);

	if (words.length === 0) {
		return "operation";
	}

	// First word is lowercase, rest are capitalized
	const camelCased = words
		.map((word, index) => {
			if (index === 0) {
				return word.charAt(0).toLowerCase() + word.slice(1).toLowerCase();
			}
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join("");

	// Prefix with _ if starts with number
	if (/^[0-9]/.test(camelCased)) {
		return `_${camelCased}`;
	}

	return camelCased;
}
