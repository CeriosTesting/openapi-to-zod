import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import { extractPathParams, generateMethodName, sanitizeParamName } from "../utils/method-naming";

interface EndpointInfo {
	path: string;
	method: string;
	methodName: string;
	pathParams: string[];
	parameters?: any[];
	requestBody?: any;
}

/**
 * Generates the ApiClient class code
 * The client is a thin passthrough layer with no validation
 * Pure wrapper around Playwright's APIRequestContext with raw options
 * @param spec - OpenAPI specification
 * @param className - Name for the generated client class (default: "ApiClient")
 */
export function generateClientClass(spec: OpenAPISpec, className: string = "ApiClient"): string {
	const endpoints = extractEndpoints(spec);

	if (endpoints.length === 0) {
		return "";
	}

	const methods = endpoints.map(endpoint => generateClientMethod(endpoint)).join("\n\n");

	return `import type { ReadStream } from "node:fs";

/**
 * Represents a value that can be used in multipart form data
 */
export type MultipartFormValue = string | number | boolean | ReadStream | { name: string; mimeType: string; buffer: Buffer };

/**
 * Serializes query parameters, converting arrays to comma-separated strings
 * @param params - Query parameters object
 * @returns Serialized params compatible with Playwright
 */
function serializeParams(params: { [key: string]: string | number | boolean | string[] | number[] | boolean[] } | URLSearchParams | string | undefined): { [key: string]: string | number | boolean } | URLSearchParams | string | undefined {
	if (!params || typeof params === 'string' || params instanceof URLSearchParams) {
		return params;
	}

	const serialized: { [key: string]: string | number | boolean } = {};
	for (const [key, value] of Object.entries(params)) {
		if (Array.isArray(value)) {
			// Serialize arrays as comma-separated strings
			serialized[key] = value.join(',');
		} else {
			serialized[key] = value;
		}
	}
	return serialized;
}

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
	data?: string | Buffer | any;
	form?: { [key: string]: string | number | boolean } | FormData;
	multipart?: FormData | { [key: string]: MultipartFormValue };
	params?: { [key: string]: string | number | boolean | string[] | number[] | boolean[] } | URLSearchParams | string;
	headers?: { [key: string]: string };
	timeout?: number;
	failOnStatusCode?: boolean;
	ignoreHTTPSErrors?: boolean;
	maxRedirects?: number;
	maxRetries?: number;
};

/**
 * Thin passthrough client for API requests
 * Pure wrapper around Playwright's APIRequestContext
 * Exposes path parameters and raw Playwright options
 */
export class ${className} {
	constructor(private readonly request: APIRequestContext) {}

${methods}
}
`;
}

/**
 * Extracts all endpoints from OpenAPI spec
 */
function extractEndpoints(spec: OpenAPISpec): EndpointInfo[] {
	const endpoints: EndpointInfo[] = [];

	if (!spec.paths) {
		return endpoints;
	}

	for (const [path, pathItem] of Object.entries(spec.paths)) {
		if (!pathItem || typeof pathItem !== "object") continue;

		const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

		for (const method of methods) {
			const operation = pathItem[method];
			if (operation) {
				const methodName = generateMethodName(method, path);
				const pathParams = extractPathParams(path);

				endpoints.push({
					path,
					method: method.toUpperCase(),
					methodName,
					pathParams,
					parameters: operation.parameters || [],
					requestBody: operation.requestBody,
				});
			}
		}
	}

	return endpoints;
}

/**
 * Generates a single client method - pure passthrough to Playwright
 */
function generateClientMethod(endpoint: EndpointInfo): string {
	const { path, method, methodName, pathParams } = endpoint;

	// Build parameter list
	const params: string[] = [];

	// Add path parameters as required arguments
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		params.push(`${sanitized}: string`);
	}

	// Add raw Playwright options parameter
	params.push("options?: ApiRequestContextOptions");

	const paramList = params.join(", ");

	// Build URL with path parameter interpolation
	let urlTemplate = path;
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		urlTemplate = urlTemplate.replace(`{${param}}`, `\${${sanitized}}`);
	}

	// Generate method body - serialize params if present
	const methodLower = method.toLowerCase();

	return `\t/**
	 * ${method} ${path}
	 * @returns Raw Playwright APIResponse
	 */
	async ${methodName}(${paramList}): Promise<APIResponse> {
		const serializedOptions = options ? { ...options, params: serializeParams(options.params) } : options;
		return await this.request.${methodLower}(\`${urlTemplate}\`, serializedOptions);
	}`;
}
