import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import type { PlaywrightOperationFilters } from "../types";
import { extractPathParams, generateMethodName, sanitizeParamName } from "../utils/method-naming";
import { shouldIncludeOperation } from "../utils/operation-filters";
import { generateOperationJSDoc } from "../utils/string-utils";

/**
 * Normalizes a base path by ensuring it has a leading slash and no trailing slash
 * Returns undefined for empty strings, single slash, or undefined values
 * @param basePath - The base path to normalize
 * @returns Normalized base path or undefined
 */
function normalizeBasePath(basePath?: string): string | undefined {
	if (!basePath || basePath === "/" || basePath.trim() === "") {
		return undefined;
	}

	let normalized = basePath.trim();
	// Ensure leading slash
	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`;
	}
	// Remove trailing slash
	if (normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1);
	}

	return normalized;
}

/**
 * Constructs the full path by combining base path with endpoint path
 * Ensures proper slash handling to avoid double slashes
 * @param basePath - The normalized base path (optional)
 * @param path - The endpoint path from OpenAPI spec
 * @returns The complete path
 */
function constructFullPath(basePath: string | undefined, path: string): string {
	if (!basePath) {
		return path;
	}

	// Ensure path has leading slash
	let normalizedPath = path.trim();
	if (!normalizedPath.startsWith("/")) {
		normalizedPath = `/${normalizedPath}`;
	}

	return basePath + normalizedPath;
}

interface EndpointInfo {
	path: string;
	method: string;
	methodName: string;
	pathParams: string[];
	parameters?: any[];
	requestBody?: any;
	deprecated?: boolean;
	summary?: string;
	description?: string;
}

/**
 * Generates the ApiClient class code
 * The client is a thin passthrough layer with no validation
 * Pure wrapper around Playwright's APIRequestContext with raw options
 * @param spec - OpenAPI specification
 * @param className - Name for the generated client class (default: "ApiClient")
 * @param basePath - Optional base path to prepend to all endpoints
 * @param operationFilters - Optional operation filters to apply
 * @param useOperationId - Whether to use operationId for method names (default: true)
 */
export function generateClientClass(
	spec: OpenAPISpec,
	className: string = "ApiClient",
	basePath?: string,
	operationFilters?: PlaywrightOperationFilters,
	useOperationId: boolean = true
): string {
	const endpoints = extractEndpoints(spec, operationFilters, useOperationId);

	// Warn if all operations were filtered out
	if (operationFilters && endpoints.length === 0) {
		// Count total operations
		let totalOperations = 0;
		if (spec.paths) {
			for (const pathItem of Object.values(spec.paths)) {
				if (!pathItem || typeof pathItem !== "object") continue;
				const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
				for (const method of methods) {
					if (pathItem[method]) totalOperations++;
				}
			}
		}

		if (totalOperations > 0) {
			console.warn(
				`⚠️  Warning: All ${totalOperations} operations were filtered out. Check your operationFilters configuration.`
			);
		}
	}

	if (endpoints.length === 0) {
		return "";
	}

	const normalizedBasePath = normalizeBasePath(basePath);
	const methods = endpoints.map(endpoint => generateClientMethod(endpoint, normalizedBasePath)).join("\n\n");

	return `import type { ReadStream } from "node:fs";

/**
 * Represents a value that can be used in multipart form data
 */
export type MultipartFormValue = string | number | boolean | ReadStream | { name: string; mimeType: string; buffer: Buffer };

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
 * @param spec - OpenAPI specification
 * @param operationFilters - Optional operation filters to apply
 * @param useOperationId - Whether to use operationId for method names (default: true)
 */
function extractEndpoints(
	spec: OpenAPISpec,
	operationFilters?: PlaywrightOperationFilters,
	useOperationId: boolean = true
): EndpointInfo[] {
	const endpoints: EndpointInfo[] = [];

	if (!spec.paths) {
		return endpoints;
	}

	for (const [path, pathItem] of Object.entries(spec.paths)) {
		if (!pathItem || typeof pathItem !== "object") continue;

		const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

		for (const method of methods) {
			const operation = pathItem[method];
			if (!operation) continue;

			// Apply operation filters
			if (!shouldIncludeOperation(operation, path, method, operationFilters)) {
				continue;
			}

			// Use operationId if useOperationId is true and operationId exists, otherwise generate from path
			const methodName =
				useOperationId && operation.operationId ? operation.operationId : generateMethodName(method, path);
			const pathParams = extractPathParams(path);

			endpoints.push({
				path,
				method: method.toUpperCase(),
				methodName,
				pathParams,
				parameters: operation.parameters || [],
				requestBody: operation.requestBody,
				deprecated: operation.deprecated,
				summary: operation.summary,
				description: operation.description,
			});
		}
	}

	return endpoints;
}

/**
 * Generates a single client method - pure passthrough to Playwright
 */
function generateClientMethod(endpoint: EndpointInfo, basePath?: string): string {
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

	// Construct full path with base path if provided
	const fullPath = constructFullPath(basePath, path);

	// Build URL with path parameter interpolation
	let urlTemplate = fullPath;
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		urlTemplate = urlTemplate.replace(`{${param}}`, `\${${sanitized}}`);
	}

	// Generate method body - serialize params if present
	const methodLower = method.toLowerCase();

	const jsdoc = generateOperationJSDoc({
		summary: endpoint.summary,
		description: endpoint.description,
		deprecated: endpoint.deprecated,
		method,
		path: fullPath,
		additionalTags: ["@returns Raw Playwright APIResponse"],
	});

	return `${jsdoc}
	async ${methodName}(${paramList}): Promise<APIResponse> {
		const serializedOptions = options ? { ...options, params: serializeParams(options.params) } : options;
		return await this.request.${methodLower}(\`${urlTemplate}\`, serializedOptions);
	}`;
}
