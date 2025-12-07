import type { OpenAPISchema } from "../types";
import { escapeJSDoc } from "../utils/string-utils";

export interface JSDocOptions {
	includeDescriptions: boolean;
}

/**
 * Generate JSDoc comment for a schema or property
 */
export function generateJSDoc(
	schema: OpenAPISchema,
	name?: string,
	options: JSDocOptions = { includeDescriptions: true }
): string {
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

	// Add title if different from name
	if (schema.title && (!name || schema.title !== name)) {
		parts.push(schema.title);
	}

	// Add description
	if (schema.description) {
		parts.push(escapeJSDoc(schema.description));
	}

	// Add examples
	if (schema.examples && schema.examples.length > 0) {
		const examplesStr = schema.examples.map(ex => JSON.stringify(ex)).join(", ");
		parts.push(`@example ${examplesStr}`);
	} else if (schema.example !== undefined) {
		parts.push(`@example ${JSON.stringify(schema.example)}`);
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
