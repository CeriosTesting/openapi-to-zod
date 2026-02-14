/**
 * Method naming utilities for API client generation
 *
 * Provides utilities for converting OpenAPI paths and operations
 * into valid TypeScript method names.
 */

import { capitalize } from "./name-utils";

/**
 * Normalize path segment special characters for method naming
 */
function normalizePathSegmentForMethodName(segment: string): string {
	return segment.replace(/@/g, "-at-");
}

/**
 * Converts an OpenAPI path to a PascalCase method name part
 *
 * @param pathString - The OpenAPI path (e.g., "/users/{userId}")
 * @returns PascalCase string (e.g., "UsersByUserId")
 *
 * @example
 * pathToPascalCase("/users/{userId}") // "UsersByUserId"
 * pathToPascalCase("/auth/login") // "AuthLogin"
 * pathToPascalCase("/api/v1/organizations/{orgId}/repos/{repoId}") // "ApiV1OrganizationsByOrgIdReposByRepoId"
 */
export function pathToPascalCase(pathString: string): string {
	const segments = pathString.split("/").filter(Boolean);

	// Handle root path
	if (segments.length === 0) {
		return "Root";
	}

	return segments
		.map(segment => {
			// Handle path parameters like {userId}
			if (segment.startsWith("{") && segment.endsWith("}")) {
				const paramName = segment.slice(1, -1);
				return `By${capitalize(normalizePathSegmentForMethodName(paramName))}`;
			}
			// Convert regular segments to PascalCase
			return capitalize(normalizePathSegmentForMethodName(segment));
		})
		.join("");
}

/**
 * Generates a method name from HTTP method and path
 *
 * @param httpMethod - The HTTP method (GET, POST, etc.)
 * @param pathString - The OpenAPI path
 * @returns Method name in camelCase
 *
 * @example
 * generateMethodName("GET", "/users/{userId}") // "getUsersByUserId"
 * generateMethodName("POST", "/auth/login") // "postAuthLogin"
 */
export function generateHttpMethodName(httpMethod: string, pathString: string): string {
	const methodPrefix = httpMethod.toLowerCase();
	const pathPart = pathToPascalCase(pathString);
	return methodPrefix + pathPart;
}

/**
 * Extracts path parameters from an OpenAPI path
 *
 * @param pathString - The OpenAPI path
 * @returns Array of parameter names
 *
 * @example
 * extractPathParams("/users/{userId}/posts/{postId}") // ["userId", "postId"]
 */
export function extractPathParams(pathString: string): string[] {
	const params: string[] = [];
	const regex = /\{([^}]+)\}/g;
	let match: RegExpExecArray | null = regex.exec(pathString);

	while (match !== null) {
		params.push(match[1]);
		match = regex.exec(pathString);
	}

	return params;
}

/**
 * Converts a path parameter name to a valid TypeScript parameter name
 *
 * Handles kebab-case, snake_case, and special characters.
 *
 * @param paramName - The parameter name from the path
 * @returns Valid TypeScript identifier
 *
 * @example
 * sanitizeParamName("user-id") // "userId"
 * sanitizeParamName("user_id") // "userId"
 * sanitizeParamName("123start") // "_123start"
 */
export function sanitizeParamName(paramName: string): string {
	// Convert kebab-case and snake_case to camelCase
	const camelCased = paramName
		.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase())
		.replace(/[^a-zA-Z0-9]/g, "");

	// Prefix with _ if starts with number
	if (/^[0-9]/.test(camelCased)) {
		return `_${camelCased}`;
	}

	return camelCased;
}

/**
 * Sanitizes an operationId to be a valid TypeScript identifier in camelCase
 *
 * Handles kebab-case, snake_case, PascalCase, and other special characters.
 *
 * @param operationId - The operationId from the OpenAPI spec
 * @returns Valid camelCase TypeScript identifier
 *
 * @example
 * sanitizeOperationId("get-users") // "getUsers"
 * sanitizeOperationId("create_user") // "createUser"
 * sanitizeOperationId("GetUsers") // "getUsers"
 */
export function sanitizeOperationId(operationId: string): string {
	// Check if already a valid identifier
	const isValidIdentifier = /^[a-zA-Z][a-zA-Z0-9]*$/.test(operationId);

	if (isValidIdentifier) {
		// Already valid - just ensure it starts with lowercase (camelCase)
		return operationId.charAt(0).toLowerCase() + operationId.slice(1);
	}

	// Has special characters - need to transform
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
