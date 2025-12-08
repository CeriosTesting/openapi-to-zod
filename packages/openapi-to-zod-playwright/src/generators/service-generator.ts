import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import { extractPathParams, generateMethodName, sanitizeParamName } from "../utils/method-naming";

interface ResponseInfo {
	statusCode: string;
	schema?: string;
	schemaName?: string;
	description?: string;
	hasBody: boolean;
}

interface EndpointInfo {
	path: string;
	method: string;
	methodName: string;
	pathParams: string[];
	parameters?: any[];
	requestBody?: any;
	responses: ResponseInfo[];
	hasErrorResponses: boolean;
}

/**
 * Generates the ApiService class code
 * The service layer enforces validation and has separate methods per status code
 */
export function generateServiceClass(spec: OpenAPISpec, schemaImports: Set<string>): string {
	const endpoints = extractEndpoints(spec);

	if (endpoints.length === 0) {
		return "";
	}

	const methods = endpoints
		.flatMap(endpoint => [
			...generateSuccessMethods(endpoint, schemaImports),
			...(endpoint.hasErrorResponses ? [generateErrorMethod(endpoint)] : []),
		])
		.join("\n\n");

	return `
/**
 * Type-safe API service with validation
 * Separate methods for each status code
 * All requests validated with Zod schemas
 */
export class ApiService {
	constructor(private readonly client: ApiClient) {}

${methods}
}
`;
}

/**
 * Extracts all endpoints with their response information
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
			if (!operation) continue;

			const methodName = generateMethodName(method, path);
			const pathParams = extractPathParams(path);

			const responses: ResponseInfo[] = [];
			let hasErrorResponses = false;

			if (operation.responses) {
				for (const [statusCode, responseObj] of Object.entries(operation.responses)) {
					if (typeof responseObj !== "object" || !responseObj) continue;

					const status = Number.parseInt(statusCode, 10);
					const isSuccess = status >= 200 && status < 300;
					const isError = status >= 400;

					if (isError) {
						hasErrorResponses = true;
					}

					// Check if response has a body
					const content = (responseObj as any).content;
					let hasBody = false;
					let schemaRef: string | undefined;
					let schemaName: string | undefined;

					if (content && typeof content === "object") {
						const jsonContent = content["application/json"];
						if (jsonContent?.schema) {
							hasBody = true;
							schemaRef = jsonContent.schema.$ref;
							if (schemaRef) {
								// Extract schema name from $ref
								const parts = schemaRef.split("/");
								schemaName = parts[parts.length - 1];
							}
						}
					}

					// Only add success responses to the list
					if (isSuccess) {
						responses.push({
							statusCode,
							schema: schemaRef,
							schemaName,
							description: (responseObj as any).description,
							hasBody: hasBody && statusCode !== "204",
						});
					}
				}
			}

			endpoints.push({
				path,
				method: method.toUpperCase(),
				methodName,
				pathParams,
				parameters: operation.parameters,
				requestBody: operation.requestBody,
				responses,
				hasErrorResponses,
			});
		}
	}

	return endpoints;
}

/**
 * Generates success methods for an endpoint
 * One method per status code if multiple, otherwise no suffix
 */
function generateSuccessMethods(endpoint: EndpointInfo, schemaImports: Set<string>): string[] {
	const { responses } = endpoint;

	if (responses.length === 0) {
		// No responses defined - create a basic method
		return [generateServiceMethod(endpoint, undefined, schemaImports, false)];
	}

	if (responses.length === 1) {
		// Single response - no status suffix
		return [generateServiceMethod(endpoint, responses[0], schemaImports, false)];
	}

	// Multiple responses - add status suffix to each
	return responses.map(response => generateServiceMethod(endpoint, response, schemaImports, true));
}

/**
 * Generates a single service method
 */
function generateServiceMethod(
	endpoint: EndpointInfo,
	response: ResponseInfo | undefined,
	schemaImports: Set<string>,
	includeStatusSuffix: boolean
): string {
	const { path, method, methodName, pathParams, requestBody } = endpoint;

	// Determine method name
	const finalMethodName = includeStatusSuffix && response ? `${methodName}${response.statusCode}` : methodName;

	// Build parameter list
	const params: string[] = [];

	// Add path parameters
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		params.push(`${sanitized}: string`);
	}

	// Determine if we need request options
	const hasRequestBody = requestBody?.content?.["application/json"];
	const needsOptions = hasRequestBody || (endpoint.parameters && endpoint.parameters.length > 0);

	if (needsOptions) {
		const optionsProps: string[] = [];

		// Add query parameters
		if (endpoint.parameters?.some((p: any) => p.in === "query")) {
			optionsProps.push("query?: Record<string, any>");
		}

		// Add headers
		if (endpoint.parameters?.some((p: any) => p.in === "header")) {
			optionsProps.push("headers?: Record<string, string>");
		}

		// Add request body (data)
		if (hasRequestBody) {
			const schema = requestBody.content["application/json"].schema;
			const isRequired = requestBody.required === true;
			const optionalMarker = isRequired ? "" : "?";

			if (schema?.$ref) {
				const schemaName = schema.$ref.split("/").pop();
				const requestSchemaName = `${schemaName}`;
				optionsProps.push(`data${optionalMarker}: ${requestSchemaName}`);
				schemaImports.add(requestSchemaName);
			} else {
				optionsProps.push(`data${optionalMarker}: any`);
			}
		}

		// Determine if options itself should be optional
		const hasOnlyOptionalProps = optionsProps.every(prop => prop.includes("?:"));
		const optionalOptionsMarker = hasOnlyOptionalProps ? "?" : "";
		params.push(`options${optionalOptionsMarker}: { ${optionsProps.join("; ")} }`);
	}

	const paramList = params.join(", ");

	// Determine return type
	let returnType = "Promise<void>";
	if (response?.hasBody && response.schemaName) {
		// Convert schema name to type name (remove Schema suffix if present)
		const typeName = response.schemaName.endsWith("Schema") ? response.schemaName.slice(0, -6) : response.schemaName;
		returnType = `Promise<${typeName}>`;
		schemaImports.add(response.schemaName);
		schemaImports.add(typeName);
	} else if (response?.statusCode === "204") {
		returnType = "Promise<null>";
	}

	// Generate method body
	const statusCode = response?.statusCode || "200";
	const clientMethod = methodName;
	const clientArgs = pathParams.map(p => sanitizeParamName(p)).join(", ");
	const clientCall =
		pathParams.length > 0
			? `this.client.${clientMethod}(${clientArgs}${needsOptions ? ", options" : ""})`
			: `this.client.${clientMethod}(${needsOptions ? "options" : ""})`;

	// Build validation code
	const validationCode: string[] = [];

	// Add request validation if needed
	if (hasRequestBody && requestBody.content["application/json"].schema?.$ref) {
		const schemaName = requestBody.content["application/json"].schema.$ref.split("/").pop();
		const schemaVar = `${schemaName.charAt(0).toLowerCase() + schemaName.slice(1)}Schema`;
		validationCode.push(`\t\tif (options?.data) {`);
		validationCode.push(`\t\t\t${schemaVar}.parse(options.data);`);
		validationCode.push(`\t\t}`);
		validationCode.push("");
	}

	// Add client call
	validationCode.push(`\t\tconst response = await ${clientCall};`);
	validationCode.push("");

	// Add status validation
	validationCode.push(`\t\t// Validate status code`);
	validationCode.push(`\t\texpect(response.status()).toBe(${statusCode});`);
	validationCode.push("");

	// Add response validation
	if (response?.hasBody && response.schemaName) {
		const schemaVar = `${response.schemaName.charAt(0).toLowerCase() + response.schemaName.slice(1)}Schema`;
		validationCode.push(`\t\t// Parse and validate response body`);
		validationCode.push(`\t\tconst body = await response.json();`);
		validationCode.push(`\t\treturn ${schemaVar}.parse(body);`);
	} else if (response?.statusCode === "204") {
		validationCode.push(`\t\treturn null;`);
	} else {
		validationCode.push(`\t\treturn;`);
	}

	return `\t/**
	 * ${method} ${path}${response ? ` (${statusCode})` : ""}
	 ${response?.description ? `* ${response.description}` : ""}
	 */
	async ${finalMethodName}(${paramList}): ${returnType} {
${validationCode.join("\n")}
	}`;
}

/**
 * Generates an error method for testing error responses
 */
function generateErrorMethod(endpoint: EndpointInfo): string {
	const { path, method, methodName, pathParams, requestBody } = endpoint;

	// Build parameter list
	const params: string[] = [];

	// Add path parameters
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		params.push(`${sanitized}: string`);
	}

	// Add options if needed - all Partial with type outlines
	const hasRequestBody = requestBody?.content?.["application/json"];
	const needsOptions = hasRequestBody || (endpoint.parameters && endpoint.parameters.length > 0);

	if (needsOptions) {
		const optionsProps: string[] = [];

		if (endpoint.parameters?.some((p: any) => p.in === "query")) {
			optionsProps.push("query?: Record<string, any>");
		}

		if (endpoint.parameters?.some((p: any) => p.in === "header")) {
			optionsProps.push("headers?: Record<string, string>");
		}

		if (hasRequestBody) {
			const schema = requestBody.content["application/json"].schema;
			if (schema?.$ref) {
				const schemaName = schema.$ref.split("/").pop();
				optionsProps.push(`data?: Partial<${schemaName}>`);
			} else {
				optionsProps.push("data?: Partial<any>");
			}
		}

		params.push(`options?: { ${optionsProps.join("; ")} }`);
	}

	const paramList = params.join(", ");

	// Generate method body
	const clientMethod = methodName;
	const clientArgs = pathParams.map(p => sanitizeParamName(p)).join(", ");
	const clientCall =
		pathParams.length > 0
			? `this.client.${clientMethod}(${clientArgs}${needsOptions ? ", options" : ""})`
			: `this.client.${clientMethod}(${needsOptions ? "options" : ""})`;

	return `\t/**
	 * ${method} ${path} - Error response (4xx/5xx)
	 * For testing error scenarios - no status validation
	 */
	async ${methodName}Error(${paramList}): Promise<APIResponse> {
		return await ${clientCall};
	}`;
}
