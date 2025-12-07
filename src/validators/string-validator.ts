import type { OpenAPISchema } from "../types";
import { addDescription, escapePattern } from "../utils/string-utils";

// Performance optimization: Cache compiled regex patterns
const PATTERN_CACHE = new Map<string, string>();

const FORMAT_MAP: Record<string, string> = {
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
	"date-time": "z.iso.datetime()",
	time: "z.iso.time()",
	duration: "z.iso.duration()",
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
};

/**
 * Generate Zod validation for string with format (Zod v4 compatible)
 */
export function generateStringValidation(schema: OpenAPISchema, useDescribe: boolean): string {
	// Handle format with Zod v4 top-level functions (performance optimized with map)
	let validation = FORMAT_MAP[schema.format || ""] || "z.string()";

	// Add length constraints
	if (schema.minLength !== undefined) {
		validation += `.min(${schema.minLength})`;
	}
	if (schema.maxLength !== undefined) {
		validation += `.max(${schema.maxLength})`;
	}

	// Add pattern
	if (schema.pattern) {
		let escapedPattern = PATTERN_CACHE.get(schema.pattern);
		if (!escapedPattern) {
			escapedPattern = escapePattern(schema.pattern);
			PATTERN_CACHE.set(schema.pattern, escapedPattern);
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
			let escapedPattern = PATTERN_CACHE.get(schema.pattern);
			if (!escapedPattern) {
				escapedPattern = escapePattern(schema.pattern);
				PATTERN_CACHE.set(schema.pattern, escapedPattern);
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
			validation += `.refine((val) => { try { return val.trim().length > 0 && !/^[\\[\\{]/.test(val.trim()); } catch { return false; } }, { message: "Must be valid YAML" })`;
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
