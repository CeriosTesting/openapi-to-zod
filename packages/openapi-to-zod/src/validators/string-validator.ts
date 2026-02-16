import { escapePattern, type LRUCache } from "@cerios/openapi-core";

import type { OpenAPISchema } from "../types";
import { addDescription } from "../utils/string-utils";

/**
 * Context for string validation generation (parallel-safe)
 */
export interface StringValidatorContext {
	/**
	 * Zod validation string for date-time format fields
	 */
	dateTimeValidation: string;
	/**
	 * Instance-level cache for escaped regex patterns
	 */
	patternCache: LRUCache<string, string>;
}

// Default format map (immutable, without date-time which is passed via context)
const DEFAULT_FORMAT_MAP: Record<string, string> = {
	uuid: "z.uuid()",
	email: "z.email()",
	uri: "z.url()",
	url: "z.url()",
	"uri-reference": 'z.string().refine((val) => !/\\s/.test(val), { message: "Must be a valid URI reference" })',
	hostname:
		'z.string().refine((val) => /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)*(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/.test(val), { message: "Must be a valid hostname" })',
	byte: "z.base64()",
	binary: "z.string()",
	date: "z.iso.date()",
	time: "z.iso.time()",
	duration:
		'z.string().refine((val) => /^P(?:(?:\\d+Y)?(?:\\d+M)?(?:\\d+D)?(?:T(?:\\d+H)?(?:\\d+M)?(?:\\d+(?:\\.\\d+)?S)?)?|\\d+W)$/.test(val) && !/^PT?$/.test(val), { message: "Must be a valid ISO 8601 duration" })',
	ipv4: "z.ipv4()",
	ipv6: "z.ipv6()",
	emoji: "z.emoji()",
	base64: "z.base64()",
	base64url: "z.base64url()",
	nanoid: "z.nanoid()",
	cuid: "z.cuid()",
	cuid2: "z.cuid2()",
	ulid: "z.ulid()",
	cidr: "z.cidrv4()", // Default to v4
	cidrv4: "z.cidrv4()",
	cidrv6: "z.cidrv6()",
	"json-pointer":
		'z.string().refine((val) => val === "" || /^(\\/([^~/]|~0|~1)+)+$/.test(val), { message: "Must be a valid JSON Pointer (RFC 6901)" })',
	"relative-json-pointer":
		'z.string().refine((val) => /^(0|[1-9]\\d*)(#|(\\/([^~/]|~0|~1)+)*)$/.test(val), { message: "Must be a valid relative JSON Pointer" })',
};

/**
 * Build the Zod validation string for date-time format
 * Pure function that returns the validation string without side effects
 *
 * @param pattern - Optional regex pattern (string or RegExp) for date-time validation
 * @returns Zod validation string (either "z.iso.datetime()" or custom regex)
 * @throws {Error} If the provided pattern is not a valid regular expression
 *
 * @example
 * // Default (no pattern)
 * buildDateTimeValidation() // Returns "z.iso.datetime()"
 *
 * @example
 * // String pattern (for JSON/YAML configs)
 * buildDateTimeValidation('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$')
 *
 * @example
 * // RegExp literal (TypeScript configs)
 * buildDateTimeValidation(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
 */
export function buildDateTimeValidation(pattern?: string | RegExp): string {
	if (!pattern) {
		return "z.iso.datetime()";
	}

	// Convert RegExp to string if needed
	const patternStr = pattern instanceof RegExp ? pattern.source : pattern;

	// Empty string returns default
	if (patternStr === "") {
		return "z.iso.datetime()";
	}

	// Validate the regex pattern
	try {
		new RegExp(patternStr);
	} catch (error) {
		throw new Error(
			`Invalid regular expression pattern for customDateTimeFormatRegex: ${patternStr}. ${
				error instanceof Error ? error.message : "Pattern is malformed"
			}`
		);
	}

	// Escape the pattern for use in generated code
	const escapedPattern = escapePattern(patternStr);

	return `z.string().regex(/${escapedPattern}/)`;
}

/**
 * Generate Zod validation for string with format (Zod v4 compatible)
 * Thread-safe: uses context for date-time validation and pattern cache
 *
 * @param schema - OpenAPI schema to generate validation for
 * @param useDescribe - Whether to add .describe() calls
 * @param context - Context containing dateTimeValidation and patternCache (parallel-safe)
 */
export function generateStringValidation(
	schema: OpenAPISchema,
	useDescribe: boolean,
	context: StringValidatorContext
): string {
	// Handle format with Zod v4 top-level functions
	// Use context.dateTimeValidation for date-time format, DEFAULT_FORMAT_MAP for others
	let validation: string;
	const format = schema.format || "";

	if (format === "date-time") {
		validation = context.dateTimeValidation;
	} else {
		validation = DEFAULT_FORMAT_MAP[format] || "z.string()";
	}

	// Add length constraints
	if (schema.minLength !== undefined) {
		validation += `.min(${schema.minLength})`;
	}
	if (schema.maxLength !== undefined) {
		validation += `.max(${schema.maxLength})`;
	}

	// Add pattern (with cached escaping for performance using context.patternCache)
	if (schema.pattern) {
		let escapedPattern = context.patternCache.get(schema.pattern);
		if (escapedPattern === undefined) {
			escapedPattern = escapePattern(schema.pattern);
			context.patternCache.set(schema.pattern, escapedPattern);
		}
		validation += `.regex(/${escapedPattern}/)`;
	}

	// Handle content encoding (OpenAPI 3.1)
	if (schema.contentEncoding && !schema.format) {
		switch (schema.contentEncoding) {
			case "base64":
				validation = "z.base64()";
				break;
			case "base64url":
				validation = "z.base64url()";
				break;
			case "quoted-printable":
				// Quoted-printable validation
				validation =
					'z.string().refine((val) => /^[\\x20-\\x7E\\r\\n=]*$/.test(val), { message: "Must be valid quoted-printable encoding" })';
				break;
			case "7bit":
			case "8bit":
			case "binary":
				// Basic string validation for these encodings
				validation = "z.string()";
				break;
			default:
				// Unknown encoding, use string with refinement note
				validation = `z.string().describe("Content encoding: ${schema.contentEncoding}")`;
		}

		// Re-apply constraints after encoding
		if (schema.minLength !== undefined) {
			validation += `.min(${schema.minLength})`;
		}
		if (schema.maxLength !== undefined) {
			validation += `.max(${schema.maxLength})`;
		}
		if (schema.pattern) {
			let escapedPattern = context.patternCache.get(schema.pattern);
			if (escapedPattern === undefined) {
				escapedPattern = escapePattern(schema.pattern);
				context.patternCache.set(schema.pattern, escapedPattern);
			}
			validation += `.regex(/${escapedPattern}/)`;
		}
	} else if (schema.contentMediaType) {
		// Add refinement for media type validation
		const mediaType = schema.contentMediaType;
		if (mediaType === "application/json") {
			validation += `.refine((val) => { try { JSON.parse(val); return true; } catch { return false; } }, { message: "Must be valid JSON" })`;
		} else if (mediaType === "application/xml" || mediaType === "text/xml") {
			// Basic XML validation - check for well-formed XML structure
			validation += `.refine((val) => { try { if (typeof DOMParser !== "undefined") { const parser = new DOMParser(); const doc = parser.parseFromString(val, "text/xml"); return !doc.querySelector("parsererror"); } return /^\\s*<[^>]+>/.test(val); } catch { return false; } }, { message: "Must be valid XML" })`;
		} else if (mediaType === "application/yaml" || mediaType === "application/x-yaml" || mediaType === "text/yaml") {
			// Basic YAML validation - check for basic YAML structure
			validation += `.refine((val) => { try { return val.trim().length > 0 && !/^[[{]/.test(val.trim()); } catch { return false; } }, { message: "Must be valid YAML" })`;
		} else if (mediaType === "text/html") {
			// Basic HTML validation - check for HTML tags
			validation += `.refine((val) => /<[^>]+>/.test(val), { message: "Must contain HTML tags" })`;
		} else if (mediaType === "text/plain") {
			// Plain text - no special validation needed, but mark it
			validation += `.refine(() => true, { message: "Plain text content" })`;
		}
		// Other media types default to no validation beyond string
	}

	// Add description if useDescribe is enabled
	return addDescription(validation, schema.description, useDescribe);
}
