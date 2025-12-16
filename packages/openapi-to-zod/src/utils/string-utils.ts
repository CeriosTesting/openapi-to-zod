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
 */
export function escapePattern(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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
 */
export function isNullable(schema: OpenAPISchema): boolean {
	// OpenAPI 3.0 style: nullable: true
	if (schema.nullable === true) {
		return true;
	}
	// OpenAPI 3.1 style: type can be an array including "null"
	if (Array.isArray(schema.type)) {
		return schema.type.includes("null");
	}
	return false;
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
