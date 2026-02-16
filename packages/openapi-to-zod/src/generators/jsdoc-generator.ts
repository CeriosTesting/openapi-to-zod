import { escapeJSDoc } from "@cerios/openapi-core";

import type { OpenAPISchema } from "../types";

export interface JSDocOptions {
	includeDescriptions: boolean;
}

/**
 * Generate JSDoc comment for a schema or property
 * Type-safe with input validation to prevent JSDoc injection
 */
export function generateJSDoc(
	schema: OpenAPISchema,
	name?: string,
	options: JSDocOptions = { includeDescriptions: true }
): string {
	// Type safety: Validate schema input
	if (!schema || typeof schema !== "object") {
		return "";
	}

	if (!options.includeDescriptions) {
		// Only add @deprecated if descriptions are disabled
		if (schema.deprecated) {
			return "/** @deprecated */\n";
		}
		return "";
	}

	// Check if we have anything to document
	if (!schema.description && !schema.title && !schema.deprecated && !schema.examples && schema.example === undefined) {
		return "";
	}

	const parts: string[] = [];

	// Add title if different from name (sanitized)
	if (schema.title && typeof schema.title === "string" && (!name || schema.title !== name)) {
		// Sanitize title to prevent JSDoc injection
		const sanitizedTitle = escapeJSDoc(schema.title).replace(/@/g, "\\@");
		parts.push(sanitizedTitle);
	}

	// Add description (sanitized to prevent injection)
	if (schema.description && typeof schema.description === "string") {
		// Escape @ symbols and other JSDoc tags to prevent injection
		const sanitizedDesc = escapeJSDoc(schema.description).replace(/@/g, "\\@").replace(/\*\//g, "*\\/");
		parts.push(sanitizedDesc);
	}

	// Add examples (with type safety)
	if (schema.examples && Array.isArray(schema.examples) && schema.examples.length > 0) {
		try {
			const examplesStr = schema.examples.map(ex => JSON.stringify(ex)).join(", ");
			parts.push(`@example ${examplesStr}`);
		} catch (error) {
			// Skip examples that can't be serialized
			console.warn("Warning: Could not serialize schema examples", error);
		}
	} else if (schema.example !== undefined) {
		try {
			parts.push(`@example ${JSON.stringify(schema.example)}`);
		} catch (error) {
			// Skip example that can't be serialized
			console.warn("Warning: Could not serialize schema example", error);
		}
	}

	// Add deprecated
	if (schema.deprecated) {
		parts.push("@deprecated");
	}

	if (parts.length === 0) {
		return "";
	}

	const fullComment = parts.join(" ");
	return `/** ${fullComment} */\n`;
}
