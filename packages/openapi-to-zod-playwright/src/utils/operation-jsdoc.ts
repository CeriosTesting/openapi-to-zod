import { escapeJSDoc } from "@cerios/openapi-to-zod/internal";

/**
 * Generate JSDoc comment for an operation (endpoint)
 * Formats operation metadata with proper sanitization
 */
export function generateOperationJSDoc(operation: {
	summary?: string;
	description?: string;
	deprecated?: boolean;
	method: string;
	path: string;
	additionalTags?: string[];
}): string {
	const lines: string[] = [];

	// Add summary as the first line if present
	if (operation.summary && typeof operation.summary === "string") {
		const sanitized = escapeJSDoc(operation.summary).replace(/@/g, "\\@").replace(/\*\//g, "*\\/");
		lines.push(sanitized);
	}

	// Add description if present (separate from summary)
	if (operation.description && typeof operation.description === "string") {
		const sanitized = escapeJSDoc(operation.description).replace(/@/g, "\\@").replace(/\*\//g, "*\\/");
		lines.push(sanitized);
	}

	// Always add method + path info (for documentation and backward compatibility)
	lines.push(`${operation.method} ${operation.path}`);

	// Add deprecated tag
	if (operation.deprecated) {
		lines.push("@deprecated");
	}

	// Add any additional tags (like @returns)
	if (operation.additionalTags && operation.additionalTags.length > 0) {
		lines.push(...operation.additionalTags);
	}

	// Format as JSDoc comment
	if (lines.length === 0) {
		return "";
	}

	// Build multi-line JSDoc
	const formattedLines = lines
		.map((line, index) => {
			if (index === 0) {
				return `\t/**\n\t * ${line}`;
			}
			if (line === "") {
				return "\t *";
			}
			return `\t * ${line}`;
		})
		.join("\n");

	return `${formattedLines}\n\t */`;
}
