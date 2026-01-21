/**
 * Runtime types and helpers for generated Playwright clients
 * These are imported by generated code at runtime
 */
import type { ReadStream } from "node:fs";

/**
 * Represents a value that can be used in multipart form data
 */
export type MultipartFormValue =
	| string
	| number
	| boolean
	| ReadStream
	| { name: string; mimeType: string; buffer: Buffer };

/**
 * Query string parameters
 * Supports primitives, arrays, URLSearchParams, or raw query strings
 */
export type QueryParams =
	| { [key: string]: string | number | boolean | string[] | number[] | boolean[] }
	| URLSearchParams
	| string;

/**
 * HTTP headers as key-value pairs
 */
export type HttpHeaders = { [key: string]: string };

/**
 * URL-encoded form data
 */
export type UrlEncodedFormData = { [key: string]: string | number | boolean };

/**
 * Multipart form data for file uploads
 */
export type MultipartFormData = FormData | { [key: string]: MultipartFormValue };

/**
 * Request body data (JSON, text, or binary)
 */
export type RequestBody = string | Buffer | unknown;

/**
 * Options for API requests
 * Extends Playwright's APIRequestContext options with typed parameters
 * @property data - Request body data (JSON, text, or binary)
 * @property form - URL-encoded form data
 * @property multipart - Multipart form data for file uploads
 * @property params - Query string parameters (arrays will be serialized as comma-separated strings)
 * @property headers - HTTP headers
 * @property timeout - Request timeout in milliseconds
 * @property failOnStatusCode - Whether to fail on non-2xx status codes (default: true)
 * @property ignoreHTTPSErrors - Whether to ignore HTTPS errors (default: false)
 * @property maxRedirects - Maximum number of redirects to follow (default: 20)
 * @property maxRetries - Maximum number of retries (default: 0)
 */
export type ApiRequestContextOptions = {
	data?: RequestBody;
	form?: UrlEncodedFormData | FormData;
	multipart?: MultipartFormData;
	params?: QueryParams;
	headers?: HttpHeaders;
	timeout?: number;
	failOnStatusCode?: boolean;
	ignoreHTTPSErrors?: boolean;
	maxRedirects?: number;
	maxRetries?: number;
};

/**
 * Serializes query parameters, converting arrays to comma-separated strings
 * @param params - Query parameters object
 * @returns Serialized params compatible with Playwright
 */
export function serializeParams(
	params: QueryParams | undefined
): string | URLSearchParams | { [key: string]: string | number | boolean } | undefined {
	if (!params) {
		return undefined;
	}

	if (typeof params === "string") {
		return params;
	}

	if (params instanceof URLSearchParams) {
		return params;
	}

	// At this point, params must be the object type
	const serialized: { [key: string]: string | number | boolean } = {};
	for (const [key, value] of Object.entries(params)) {
		if (Array.isArray(value)) {
			// Serialize arrays as comma-separated strings
			serialized[key] = value.join(",");
		} else {
			// Value is already string | number | boolean
			serialized[key] = value;
		}
	}
	return serialized;
}
