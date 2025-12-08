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
 * All request properties are optional (Partial) to allow testing bad requests
 */
export function generateClientClass(spec: OpenAPISpec): string {
	const endpoints = extractEndpoints(spec);

	if (endpoints.length === 0) {
		return "";
	}

	const methods = endpoints.map(endpoint => generateClientMethod(endpoint)).join("\n\n");

	return `
/**
 * Thin passthrough client for API requests
 * No validation - allows testing invalid requests
 * All request properties are optional via Partial
 */
export class ApiClient {
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
 * Generates a single client method
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

	// Build options type based on what exists on endpoint
	const optionsParts: string[] = [];

	// Check for query parameters
	if (endpoint.parameters?.some((p: any) => p.in === "query")) {
		optionsParts.push("query?: Record<string, any>");
	}

	// Check for header parameters
	if (endpoint.parameters?.some((p: any) => p.in === "header")) {
		optionsParts.push("headers?: Record<string, string>");
	}

	// Check for request body
	const requestBody = (endpoint as any).requestBody;
	if (requestBody?.content?.["application/json"]) {
		const schema = requestBody.content["application/json"].schema;
		if (schema?.$ref) {
			const schemaName = schema.$ref.split("/").pop();
			optionsParts.push(`data?: Partial<${schemaName}>`);
		} else {
			optionsParts.push("data?: Partial<any>");
		}
	}

	// Add options parameter only if there are options
	if (optionsParts.length > 0) {
		params.push(`options?: { ${optionsParts.join("; ")} }`);
	}

	const paramList = params.join(", ");

	// Build URL with path parameter interpolation
	let urlTemplate = path;
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		urlTemplate = urlTemplate.replace(`{${param}}`, `\${${sanitized}}`);
	}

	// Generate method body
	const methodLower = method.toLowerCase();
	const hasOptions = optionsParts.length > 0;

	return `\t/**
	 * ${method} ${path}
	 * @returns Raw Playwright APIResponse
	 */
	async ${methodName}(${paramList}): Promise<APIResponse> {
		return await this.request.${methodLower}(\`${urlTemplate}\`${hasOptions ? ", options" : ""});
	}`;
}
