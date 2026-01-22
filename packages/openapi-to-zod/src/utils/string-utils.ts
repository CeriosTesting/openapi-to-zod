/**
 * String utility functions for escaping and formatting
 */

import type { OpenAPISchema } from "../types";

/**
 * Escape string for description in .describe()
 */
export function escapeDescription(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Escape regex pattern for use in code
 * Only escapes forward slashes which would terminate the regex literal
 * Handles patterns that may already have escaped forward slashes from JSON
 */
export function escapePattern(str: string): string {
	// Use negative lookbehind to only escape forward slashes that are NOT already preceded by a backslash
	return str.replace(/(?<!\\)\//g, "\\/");
}

/**
 * @shared Escape JSDoc comment content to prevent injection
 * @since 1.0.0
 * Utility used by core and playwright packages
 */
export function escapeJSDoc(str: string): string {
	return str.replace(/\*\//g, "*\\/");
}

/**
 * Wrap validation with .nullable() if needed
 */
export function wrapNullable(validation: string, isNullable: boolean): string {
	return isNullable ? `${validation}.nullable()` : validation;
}

/**
 * Check if schema is nullable (supports both OpenAPI 3.0 and 3.1 syntax)
 * @param schema - The OpenAPI schema to check
 * @param defaultNullable - Default nullable behavior when not explicitly specified (default: false)
 */
export function isNullable(schema: OpenAPISchema, defaultNullable = false): boolean {
	// OpenAPI 3.0 style: nullable explicitly set
	if (schema.nullable === true) {
		return true;
	}
	if (schema.nullable === false) {
		return false;
	}
	// OpenAPI 3.1 style: type can be an array including "null"
	if (Array.isArray(schema.type)) {
		return schema.type.includes("null");
	}
	// No explicit nullable annotation - use default
	return defaultNullable;
}

/**
 * Get the primary type from schema (handles OpenAPI 3.1 type arrays)
 */
export function getPrimaryType(schema: OpenAPISchema): string | undefined {
	if (Array.isArray(schema.type)) {
		// OpenAPI 3.1: type can be an array like ["string", "null"]
		// Return the first non-null type
		const nonNullType = schema.type.find(t => t !== "null");
		return nonNullType;
	}
	return schema.type;
}

/**
 * Check if schema has multiple non-null types
 */
export function hasMultipleTypes(schema: OpenAPISchema): boolean {
	if (Array.isArray(schema.type)) {
		const nonNullTypes = schema.type.filter(t => t !== "null");
		return nonNullTypes.length > 1;
	}
	return false;
}

/**
 * Add description to a schema validation string
 */
export function addDescription(validation: string, description: string | undefined, useDescribe: boolean): string {
	if (!description || !useDescribe) return validation;

	const escapedDesc = escapeDescription(description);
	return `${validation}.describe("${escapedDesc}")`;
}
