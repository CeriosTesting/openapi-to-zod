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
 * Convert string to PascalCase and sanitize for TypeScript identifiers
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

	// Identifiers can't start with a number - prefix with 'N'
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
export function resolveRefName(ref: string): string {
	const parts = ref.split("/");
	return parts[parts.length - 1];
}

/**
 * Capitalizes a string to PascalCase, handling special characters like dashes, underscores, and dots
 * @example
 * capitalize("user-name") // "UserName"
 * capitalize("user_id") // "UserId"
 * capitalize("api.v1") // "ApiV1"
 * capitalize("hello") // "Hello"
 */
export function capitalize(str: string): string {
	// Handle kebab-case, snake_case, and dots
	if (str.includes("-") || str.includes("_") || str.includes(".")) {
		return str
			.split(/[-_.]/)
			.map(part => {
				if (!part) return "";
				return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
			})
			.join("");
	}

	// Regular word - just capitalize first letter
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Apply prefix and suffix to a PascalCase name
 * @example
 * applyFormatting("User", "I", "Schema") // "IUserSchema"
 * applyFormatting("user-model", "I") // "IUserModel"
 */
export function applyFormatting(name: string, prefix?: string, suffix?: string): string {
	let result = toPascalCase(name);
	if (prefix) {
		result = toPascalCase(prefix) + result;
	}
	if (suffix) {
		result = result + toPascalCase(suffix);
	}
	return result;
}

/**
 * Generate a PascalCase method name from HTTP method and path
 * Used when operationId is not available
 *
 * @param httpMethod - HTTP method (get, post, put, etc.)
 * @param path - API path (e.g., "/users/{userId}/posts")
 * @returns PascalCase method name (e.g., "GetUsersByUserIdPosts")
 *
 * @example
 * generateMethodNameFromPath("get", "/users/{userId}") // "GetUsersByUserId"
 * generateMethodNameFromPath("post", "/api/v1/users") // "PostApiV1Users"
 */
export function generateMethodNameFromPath(httpMethod: string, path: string): string {
	// Convert path to PascalCase
	// e.g., GET /users/{userId}/posts -> GetUsersByUserIdPosts
	// e.g., GET /api/v0.1/users -> GetApiV01Users
	const segments = path
		.split("/")
		.filter(Boolean)
		.map(segment => {
			if (segment.startsWith("{") && segment.endsWith("}")) {
				// Path parameter - convert to "ByParamName"
				const paramName = segment.slice(1, -1);
				return `By${capitalize(paramName)}`;
			}
			// Regular segment - capitalize and handle special characters
			return capitalize(segment);
		})
		.join("");

	// Capitalize first letter of method
	const capitalizedMethod = httpMethod.charAt(0).toUpperCase() + httpMethod.slice(1).toLowerCase();
	return `${capitalizedMethod}${segments}`;
}

/**
 * Get PascalCase operation name from operationId or generate from path
 *
 * @param operationId - The operationId from OpenAPI spec (may be undefined)
 * @param httpMethod - HTTP method (get, post, put, etc.)
 * @param path - API path (e.g., "/users/{userId}")
 * @param useOperationId - Whether to prefer operationId when available
 * @returns PascalCase operation name
 */
export function getOperationName(
	operationId: string | undefined,
	httpMethod: string,
	path: string,
	useOperationId: boolean = true
): string {
	if (useOperationId && operationId) {
		// Use toPascalCase for kebab-case IDs, simple capitalization for camelCase
		return operationId.includes("-")
			? toPascalCase(operationId)
			: operationId.charAt(0).toUpperCase() + operationId.slice(1);
	}
	return generateMethodNameFromPath(httpMethod, path);
}

/**
 * Generate inline response type name
 *
 * @param operationName - PascalCase operation name
 * @param statusCode - HTTP status code (e.g., "200", "404")
 * @param hasMultipleStatuses - Whether the operation has multiple response statuses
 * @returns Type name (e.g., "GetUsersResponse" or "GetUsers200Response")
 */
export function generateInlineResponseTypeName(
	operationName: string,
	statusCode: string,
	hasMultipleStatuses: boolean
): string {
	const statusSuffix = hasMultipleStatuses ? statusCode : "";
	return `${operationName}${statusSuffix}Response`;
}

/**
 * Generate inline request type name
 *
 * @param operationName - PascalCase operation name
 * @param contentType - Content type (e.g., "application/json")
 * @param hasMultipleContentTypes - Whether the operation has multiple content types
 * @returns Type name (e.g., "PostUsersRequest" or "PostUsersJsonRequest")
 */
export function generateInlineRequestTypeName(
	operationName: string,
	contentType: string,
	hasMultipleContentTypes: boolean
): string {
	let contentTypeSuffix = "";
	if (hasMultipleContentTypes) {
		if (contentType.includes("json")) contentTypeSuffix = "Json";
		else if (contentType.includes("xml")) contentTypeSuffix = "Xml";
		else if (contentType.includes("form-data")) contentTypeSuffix = "FormData";
		else if (contentType.includes("x-www-form-urlencoded")) contentTypeSuffix = "Form";
		else if (contentType.includes("text")) contentTypeSuffix = "Text";
		else if (contentType.includes("octet-stream")) contentTypeSuffix = "Binary";
	}
	return `${operationName}${contentTypeSuffix}Request`;
}

/**
 * Generate query parameters type name
 *
 * @param operationName - PascalCase operation name
 * @returns Type name (e.g., "GetUsersQueryParams")
 */
export function generateQueryParamsTypeName(operationName: string): string {
	return `${operationName}QueryParams`;
}

/**
 * Generate header parameters type name
 *
 * @param operationName - PascalCase operation name
 * @returns Type name (e.g., "GetUsersHeaderParams")
 */
export function generateHeaderParamsTypeName(operationName: string): string {
	return `${operationName}HeaderParams`;
}

/**
 * Generate path parameters type name
 *
 * @param operationName - PascalCase operation name
 * @returns Type name (e.g., "GetUsersPathParams")
 * @internal
 */
export function generatePathParamsTypeName(operationName: string): string {
	return `${operationName}PathParams`;
}
