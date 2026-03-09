import type { Params, RequestBody, Response } from "k6/http";

/**
 * Runtime types and helpers for generated K6 clients
 * These are imported by generated code at runtime
 *
 * This module has ZERO Node.js dependencies and is safe to use in k6.
 */

/**
 * Re-export K6 Params type for convenience
 */
export type { Params } from "k6/http";

/**
 * K6 service result type - combines HTTP response with parsed data and status check result
 * Used as return type for service methods
 *
 * @template T - The type of the parsed response data (from generated types)
 *
 * @example
 * ```typescript
 * // Service method returns K6ServiceResult<User>
 * const result = service.getUserById("123");
 * if (result.ok) {
 *   console.log(result.data.name); // data is typed as User
 * } else {
 *   console.log(`Request failed with status: ${result.response.status}`);
 * }
 * ```
 */
export interface K6ServiceResult<T> {
	/** The raw K6 HTTP response */
	response: Response;
	/** The parsed response data */
	data: T;
	/** Whether the status code check passed */
	ok: boolean;
}

/**
 * Query string parameters
 * Supports primitives, arrays, or undefined values
 */
export type QueryParams = Record<
	string,
	string | number | boolean | string[] | number[] | boolean[] | undefined | null
>;

/**
 * HTTP headers as key-value pairs (can be any type, will be converted to strings)
 */
export type HttpHeaders = Record<string, unknown>;

/**
 * Merges request parameters with common parameters
 * Request-specific parameters take precedence over common parameters
 *
 * Deep-merges nested object properties: headers, tags, cookies
 *
 * @param requestParams - Request-specific K6 parameters
 * @param commonParams - Common K6 parameters set on the client
 * @returns Merged parameters with request params taking precedence
 */
export function mergeRequestParameters(requestParams: Params, commonParams: Params): Params {
	return {
		...commonParams,
		...requestParams,
		cookies: {
			...commonParams?.cookies,
			...requestParams?.cookies,
		},
		headers: {
			...commonParams?.headers,
			...requestParams?.headers,
		},
		tags: {
			...commonParams?.tags,
			...requestParams?.tags,
		},
	};
}

/**
 * Converts headers to string values (K6 requires string headers)
 *
 * @param headers - Headers object with potentially non-string values
 * @returns Headers object with all values converted to strings
 */
export function stringifyHeaders(headers: HttpHeaders): Record<string, string> {
	return Object.fromEntries(Object.entries(headers || {}).map(([key, value]) => [key, String(value)]));
}

/**
 * Builds query string from parameters object
 * Handles arrays by appending multiple values with the same key
 *
 * @param params - Query parameters object
 * @returns Query string starting with '?' or empty string if no params
 */
export function buildQueryString(params?: QueryParams): string {
	if (!params || Object.keys(params).length === 0) return "";

	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null) {
			if (Array.isArray(value)) {
				for (const v of value) {
					searchParams.append(key, String(v));
				}
			} else {
				searchParams.append(key, String(value));
			}
		}
	}

	const queryString = searchParams.toString();
	return queryString ? `?${queryString}` : "";
}

/**
 * Cleans a base URL by removing trailing slashes
 *
 * @param baseUrl - The base URL to clean
 * @returns URL without trailing slashes
 */
export function cleanBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, "");
}

/** Type guard for K6 FileData-like objects (have a 'data' property) */
function isFileDataLike(value: unknown): value is RequestBody {
	return typeof value === "object" && value !== null && "data" in value;
}

/**
 * Serializes a request body for K6 HTTP requests.
 * - null/undefined: passed through as-is
 * - string: passed through as-is (already serialized)
 * - ArrayBuffer: passed through as-is (binary data)
 * - FileData (K6 type with 'data' property): passed through as-is
 * - objects: JSON.stringify'd
 *
 * @param body - The request body to serialize
 * @returns Serialized body suitable for K6 http.request
 */
export function serializeBody(body: unknown): RequestBody | null | undefined {
	if (body === null || body === undefined) return body;
	if (typeof body === "string") return body;
	if (body instanceof ArrayBuffer) return body;
	// FileData is a K6 type with 'data' property - pass through as-is
	if (isFileDataLike(body)) return body;
	return JSON.stringify(body);
}
