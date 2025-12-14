import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import type { OperationFilters } from "../types";
import { extractPathParams, generateMethodName, sanitizeParamName } from "../utils/method-naming";
import { shouldIncludeOperation } from "../utils/operation-filters";
import { generateOperationJSDoc, toPascalCase } from "../utils//string-utils";

interface ResponseInfo {
	statusCode: string;
	schema?: string;
	schemaName?: string;
	description?: string;
	hasBody: boolean;
	contentType: string;
	inlineSchema?: any; // For inline schemas (arrays, objects without $ref)
}

interface EndpointInfo {
	path: string;
	method: string;
	methodName: string;
	pathParams: string[];
	parameters?: any[];
	requestBody?: any;
	responses: ResponseInfo[];
	queryParamSchemaName?: string; // Name of the generated query parameter schema
	headerParamSchemaName?: string; // Name of the generated header parameter schema
	deprecated?: boolean;
	summary?: string;
	description?: string;
}

/**
 * Strips charset and other parameters from content-type string
 */
function stripContentTypeParams(contentType: string): string {
	return contentType.split(";")[0].trim();
}

/**
 * Extracts a PascalCase suffix from content-type
 * Handles wildcards, standard types, vendor types with/without +suffix
 */
function extractContentTypeSuffix(contentType: string): string {
	// Handle wildcards
	if (contentType === "*/*") return "Any";
	if (contentType === "text/*") return "Text";
	if (contentType === "image/*") return "Image";
	if (contentType === "application/*") return "Application";

	// Handle standard types
	const standardTypes: Record<string, string> = {
		"application/json": "Json",
		"application/x-www-form-urlencoded": "Form",
		"multipart/form-data": "Multipart",
		"application/xml": "Xml",
		"text/xml": "Xml",
		"text/html": "Html",
		"text/plain": "Text",
		"application/pdf": "Pdf",
	};

	if (standardTypes[contentType]) {
		return standardTypes[contentType];
	}

	// Handle image/* subtypes - all become "Image"
	if (contentType.startsWith("image/")) {
		return "Image";
	}

	// Handle vendor types with +suffix (e.g., application/vnd.api+json)
	if (contentType.includes("+")) {
		const suffix = contentType.split("+")[1];
		return suffix.charAt(0).toUpperCase() + suffix.slice(1);
	}

	// Handle vendor types without +suffix (e.g., application/vnd.company-name.api)
	// Convert full path to PascalCase, replacing hyphens and periods
	const parts = contentType.split("/");
	const subtype = parts[parts.length - 1];
	return subtype
		.split(/[-.]/)
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

/**
 * Handles duplicate suffixes by appending numbers
 */
function deduplicateSuffixes(suffixes: string[]): string[] {
	const counts = new Map<string, number>();
	return suffixes.map(suffix => {
		const count = counts.get(suffix) || 0;
		counts.set(suffix, count + 1);
		return count === 0 ? suffix : `${suffix}${count + 1}`;
	});
}

/**
 * Generates the ApiService class code
 * The service layer handles content-type mapping and response validation
 * Separate methods for each request content-type and status code combination
 * @param spec - OpenAPI specification
 * @param schemaImports - Set to collect schema import names
 * @param className - Name for the generated service class (default: "ApiService")
 * @param clientClassName - Name of the client class to inject (default: "ApiClient")
 * @param operationFilters - Optional operation filters to apply
 * @param useOperationId - Whether to use operationId for method names (default: true)
 */
export function generateServiceClass(
	spec: OpenAPISpec,
	schemaImports: Set<string>,
	className: string = "ApiService",
	clientClassName: string = "ApiClient",
	operationFilters?: OperationFilters,
	useOperationId: boolean = true
): string {
	const endpoints = extractEndpoints(spec, operationFilters, useOperationId);

	if (endpoints.length === 0) {
		return "";
	}

	const methods = endpoints.flatMap(endpoint => generateSuccessMethods(endpoint, schemaImports)).join("\n\n");

	return `
/**
 * Type-safe API service with validation
 * Separate methods for each request content-type and status code
 * Response validation with Zod schemas
 */
export class ${className} {
	constructor(private readonly client: ${clientClassName}) {}

${methods}
}
`;
}

/**
 * Extracts all endpoints with their response information
 */
function extractEndpoints(
	spec: OpenAPISpec,
	operationFilters?: OperationFilters,
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
			if (operationFilters && !shouldIncludeOperation(operation, path, method, operationFilters)) {
				continue;
			}

			// Use operationId if useOperationId is true and operationId exists, otherwise generate from path
			const methodName =
				useOperationId && operation.operationId ? operation.operationId : generateMethodName(method, path);
			const pathParams = extractPathParams(path);

			const responses: ResponseInfo[] = [];

			if (operation.responses) {
				for (const [statusCode, responseObj] of Object.entries(operation.responses)) {
					if (typeof responseObj !== "object" || !responseObj) continue;

					const status = Number.parseInt(statusCode, 10);
					const isSuccess = status >= 200 && status < 300;

					if (!isSuccess) continue;

					// Extract content types and create a ResponseInfo for each
					const content = (responseObj as any).content;

					if (content && typeof content === "object") {
						// Iterate all content-type keys
						for (const [rawContentType, contentObj] of Object.entries(content)) {
							if (typeof contentObj !== "object" || !contentObj) continue;

							// Strip charset and parameters from content-type
							const contentType = stripContentTypeParams(rawContentType);

							let schemaRef: string | undefined;
							let schemaName: string | undefined;
							let inlineSchema: any;
							const hasBody = statusCode !== "204";

							if ((contentObj as any).schema) {
								const schema = (contentObj as any).schema;
								schemaRef = schema.$ref;
								if (schemaRef) {
									// Extract schema name from $ref
									const parts = schemaRef.split("/");
									schemaName = parts[parts.length - 1];
								} else {
									// No $ref - it's an inline schema
									inlineSchema = schema;
								}
							}

							responses.push({
								statusCode,
								schema: schemaRef,
								schemaName,
								description: (responseObj as any).description,
								hasBody,
								contentType,
								inlineSchema,
							});
						}
					} else {
						// No content defined - assume no body
						responses.push({
							statusCode,
							schema: undefined,
							schemaName: undefined,
							description: (responseObj as any).description,
							hasBody: false,
							contentType: "application/json", // Default fallback
						});
					}
				}
			}

			// Check if operation has query parameters
			let queryParamSchemaName: string | undefined;
			if (operation.operationId && operation.parameters && Array.isArray(operation.parameters)) {
				const hasQueryParams = operation.parameters.some(
					(param: any) => param && typeof param === "object" && param.in === "query"
				);
				if (hasQueryParams) {
					// Generate schema name matching the base generator pattern
					// Use toPascalCase only for kebab-case IDs, simple capitalization for camelCase
					const pascalOperationId = operation.operationId.includes("-")
						? toPascalCase(operation.operationId)
						: operation.operationId.charAt(0).toUpperCase() + operation.operationId.slice(1);
					queryParamSchemaName = `${pascalOperationId}QueryParams`;
				}
			}

			// Check if operation has header parameters
			let headerParamSchemaName: string | undefined;
			if (operation.operationId && operation.parameters && Array.isArray(operation.parameters)) {
				const hasHeaderParams = operation.parameters.some(
					(param: any) => param && typeof param === "object" && param.in === "header"
				);
				if (hasHeaderParams) {
					// Generate schema name matching the base generator pattern
					// Use toPascalCase only for kebab-case IDs, simple capitalization for camelCase
					const pascalOperationId = operation.operationId.includes("-")
						? toPascalCase(operation.operationId)
						: operation.operationId.charAt(0).toUpperCase() + operation.operationId.slice(1);
					headerParamSchemaName = `${pascalOperationId}HeaderParams`;
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
				queryParamSchemaName,
				headerParamSchemaName,
				deprecated: operation.deprecated,
				summary: operation.summary,
				description: operation.description,
			});
		}
	}

	return endpoints;
}

/**
 * Generates success methods for an endpoint
 * Creates method variants for each request content-type and response status/content-type combination
 */
function generateSuccessMethods(endpoint: EndpointInfo, schemaImports: Set<string>): string[] {
	const { responses, requestBody } = endpoint;
	const methods: string[] = [];

	// Extract request content-types
	const requestContentTypes: string[] = [];
	if (requestBody?.content && typeof requestBody.content === "object") {
		for (const contentType of Object.keys(requestBody.content)) {
			requestContentTypes.push(stripContentTypeParams(contentType));
		}
	}

	// If no request body, generate methods without request content-type suffix
	if (requestContentTypes.length === 0) {
		if (responses.length === 0) {
			return [generateServiceMethod(endpoint, undefined, schemaImports, "", "", "")];
		}

		// Group responses by status code
		const statusGroups = new Map<string, ResponseInfo[]>();
		for (const response of responses) {
			const group = statusGroups.get(response.statusCode) || [];
			group.push(response);
			statusGroups.set(response.statusCode, group);
		}

		const hasMultipleStatuses = statusGroups.size > 1;

		for (const [statusCode, responseGroup] of statusGroups) {
			const statusSuffix = hasMultipleStatuses ? statusCode : "";
			const hasMultipleContentTypes = responseGroup.length > 1;

			if (!hasMultipleContentTypes) {
				methods.push(generateServiceMethod(endpoint, responseGroup[0], schemaImports, statusSuffix, "", ""));
			} else {
				const suffixes = responseGroup.map(r => extractContentTypeSuffix(r.contentType));
				const deduplicated = deduplicateSuffixes(suffixes);
				for (let i = 0; i < responseGroup.length; i++) {
					methods.push(
						generateServiceMethod(endpoint, responseGroup[i], schemaImports, statusSuffix, deduplicated[i], "")
					);
				}
			}
		}
		return methods;
	}

	// Generate methods for each request content-type
	const hasMultipleRequestTypes = requestContentTypes.length > 1;
	const requestSuffixes = hasMultipleRequestTypes
		? deduplicateSuffixes(requestContentTypes.map(ct => extractContentTypeSuffix(ct)))
		: [""];

	for (let reqIdx = 0; reqIdx < requestContentTypes.length; reqIdx++) {
		const requestSuffix = requestSuffixes[reqIdx];

		if (responses.length === 0) {
			methods.push(generateServiceMethod(endpoint, undefined, schemaImports, "", "", requestSuffix));
			continue;
		}

		// Group responses by status code
		const statusGroups = new Map<string, ResponseInfo[]>();
		for (const response of responses) {
			const group = statusGroups.get(response.statusCode) || [];
			group.push(response);
			statusGroups.set(response.statusCode, group);
		}

		const hasMultipleStatuses = statusGroups.size > 1;

		for (const [statusCode, responseGroup] of statusGroups) {
			const statusSuffix = hasMultipleStatuses ? statusCode : "";
			const hasMultipleContentTypes = responseGroup.length > 1;

			if (!hasMultipleContentTypes) {
				methods.push(generateServiceMethod(endpoint, responseGroup[0], schemaImports, statusSuffix, "", requestSuffix));
			} else {
				const suffixes = responseGroup.map(r => extractContentTypeSuffix(r.contentType));
				const deduplicated = deduplicateSuffixes(suffixes);
				for (let i = 0; i < responseGroup.length; i++) {
					methods.push(
						generateServiceMethod(
							endpoint,
							responseGroup[i],
							schemaImports,
							statusSuffix,
							deduplicated[i],
							requestSuffix
						)
					);
				}
			}
		}
	}

	return methods;
}

/**
 * Generate Zod schema code for inline schemas (arrays, primitives)
 * Returns the schema code and type name
 */
function generateInlineSchemaCode(inlineSchema: any): { schemaCode: string; typeName: string } | null {
	if (!inlineSchema) return null;

	// Handle primitives
	if (inlineSchema.type === "string") {
		return { schemaCode: "z.string()", typeName: "string" };
	}
	if (inlineSchema.type === "number" || inlineSchema.type === "integer") {
		return { schemaCode: "z.number()", typeName: "number" };
	}
	if (inlineSchema.type === "boolean") {
		return { schemaCode: "z.boolean()", typeName: "boolean" };
	}

	// Handle arrays of refs
	if (inlineSchema.type === "array" && inlineSchema.items?.$ref) {
		const refParts = inlineSchema.items.$ref.split("/");
		const itemSchemaName = refParts[refParts.length - 1];
		const itemTypeName = itemSchemaName.endsWith("Schema") ? itemSchemaName.slice(0, -6) : itemSchemaName;
		return {
			schemaCode: `z.array(${itemSchemaName.charAt(0).toLowerCase() + itemSchemaName.slice(1)}Schema)`,
			typeName: `${itemTypeName}[]`,
		};
	}

	// Handle arrays of primitives
	if (inlineSchema.type === "array" && inlineSchema.items?.type) {
		const itemType = inlineSchema.items.type;
		if (itemType === "string") {
			return { schemaCode: "z.array(z.string())", typeName: "string[]" };
		}
		if (itemType === "number" || itemType === "integer") {
			return { schemaCode: "z.array(z.number())", typeName: "number[]" };
		}
		if (itemType === "boolean") {
			return { schemaCode: "z.array(z.boolean())", typeName: "boolean[]" };
		}
	}

	return null; // Plain objects and other complex types not supported - return Promise<any>
}

/**
 * Generates a single service method with content-type handling
 */
function generateServiceMethod(
	endpoint: EndpointInfo,
	response: ResponseInfo | undefined,
	schemaImports: Set<string>,
	statusSuffix: string,
	responseContentTypeSuffix: string,
	requestContentTypeSuffix: string
): string {
	const { path, method, methodName, pathParams, requestBody } = endpoint;

	// Determine method name - request suffix comes before status/response suffixes
	const finalMethodName = `${methodName}${requestContentTypeSuffix}${statusSuffix}${responseContentTypeSuffix}`;

	// Build parameter list
	const params: string[] = [];

	// Add path parameters
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		params.push(`${sanitized}: string`);
	}

	// Determine what parameters we need in options
	const hasQueryParams = endpoint.parameters?.some((p: any) => p.in === "query");
	const hasHeaderParams = endpoint.parameters?.some((p: any) => p.in === "header");

	// Extract request content-type info if we have a request body
	let requestContentType = "";
	let hasRequestBody = false;
	if (requestBody?.content) {
		if (requestContentTypeSuffix === "") {
			// Single content-type: take the first one
			const firstContentType = Object.keys(requestBody.content)[0];
			if (firstContentType) {
				requestContentType = stripContentTypeParams(firstContentType);
				hasRequestBody = true;
			}
		} else {
			// Multiple content-types: find the one matching our suffix
			for (const [ct, _ctObj] of Object.entries(requestBody.content)) {
				const stripped = stripContentTypeParams(ct);
				const suffix = extractContentTypeSuffix(stripped);
				if (requestContentTypeSuffix === suffix || requestContentTypeSuffix.startsWith(suffix)) {
					requestContentType = stripped;
					hasRequestBody = true;
					break;
				}
			}
		}
	}

	const needsOptions = hasRequestBody || hasQueryParams || hasHeaderParams;

	if (needsOptions) {
		const optionsProps: string[] = [];

		// Add query parameters with typed schema if available
		if (hasQueryParams) {
			if (endpoint.queryParamSchemaName) {
				// Use the typed query parameter schema
				schemaImports.add(endpoint.queryParamSchemaName);
				optionsProps.push(`params?: ${endpoint.queryParamSchemaName}`);
			} else {
				// Fallback to generic params
				optionsProps.push("params?: { [key: string]: string | number | boolean } | URLSearchParams | string");
			}
		}

		// Add headers with typed schema if available
		if (hasHeaderParams) {
			if (endpoint.headerParamSchemaName) {
				// Use the typed header parameter schema
				schemaImports.add(endpoint.headerParamSchemaName);
				optionsProps.push(`headers?: ${endpoint.headerParamSchemaName}`);
			} else {
				// Fallback to generic headers
				optionsProps.push("headers?: { [key: string]: string }");
			}
		}

		// Add request body based on content-type
		if (hasRequestBody && requestContentType) {
			const isRequired = requestBody.required === true;
			const optionalMarker = isRequired ? "" : "?";

			if (requestContentType === "application/json") {
				const schema =
					requestBody.content[requestContentType]?.schema || requestBody.content["application/json"]?.schema;
				if (schema?.$ref) {
					const schemaName = schema.$ref.split("/").pop();
					optionsProps.push(`data${optionalMarker}: ${schemaName}`);
					schemaImports.add(schemaName);
				} else {
					optionsProps.push(`data${optionalMarker}: string | Buffer | any`);
				}
			} else if (requestContentType === "application/x-www-form-urlencoded") {
				optionsProps.push(`form${optionalMarker}: { [key: string]: string | number | boolean } | FormData`);
			} else if (requestContentType === "multipart/form-data") {
				optionsProps.push(`multipart${optionalMarker}: FormData | { [key: string]: MultipartFormValue }`);
			} else {
				// Fallback for other content-types
				optionsProps.push(`data${optionalMarker}: string | Buffer | any`);
			}
		}

		// Determine if options itself should be optional
		const hasOnlyOptionalProps = optionsProps.every(prop => prop.includes("?:") || prop.includes("?: "));
		const optionalOptionsMarker = hasOnlyOptionalProps ? "?" : "";
		params.push(`options${optionalOptionsMarker}: { ${optionsProps.join("; ")} }`);
	}

	const paramList = params.join(", ");

	// Determine return type
	let returnType = "Promise<void>";
	if (response?.hasBody && response.schemaName) {
		const typeName = response.schemaName.endsWith("Schema") ? response.schemaName.slice(0, -6) : response.schemaName;
		returnType = `Promise<${typeName}>`;
		schemaImports.add(response.schemaName);
	} else if (response?.hasBody && response.inlineSchema) {
		const inlineInfo = generateInlineSchemaCode(response.inlineSchema);
		if (inlineInfo) {
			returnType = `Promise<${inlineInfo.typeName}>`;
		} else {
			returnType = "Promise<any>";
		}
	} else if (response?.hasBody && !response.schemaName) {
		returnType = "Promise<any>";
	}

	// Generate method body
	const statusCode = response?.statusCode || "200";
	const clientMethod = methodName;

	// Build client call with path params and options
	const pathParamArgs = pathParams.map(p => sanitizeParamName(p));
	const clientArgs =
		pathParamArgs.length > 0
			? `${pathParamArgs.join(", ")}, ${needsOptions ? "options" : "{}"}`
			: needsOptions
				? "options"
				: "{}";

	// Build validation code (for response only, not query params)
	const validationCode: string[] = [];

	// Add client call
	validationCode.push(`\t\tconst response = await this.client.${clientMethod}(${clientArgs});`);
	validationCode.push("");

	// Add status validation
	validationCode.push(`\t\t// Validate status code`);
	validationCode.push(`\t\texpect(response.status(), await response.text()).toBe(${statusCode});`);
	validationCode.push("");

	// Add response validation
	if (response?.hasBody && response.schemaName) {
		const schemaVar = `${response.schemaName.charAt(0).toLowerCase() + response.schemaName.slice(1)}Schema`;
		const isJson = response.contentType === "application/json";
		const parseMethod = isJson ? "response.json()" : "response.text()";

		validationCode.push(`\t\t// Parse and validate response body`);
		validationCode.push(`\t\tconst body = await ${parseMethod};`);
		validationCode.push(`\t\treturn ${schemaVar}.parse(body);`);
	} else if (response?.hasBody && response.inlineSchema) {
		const inlineInfo = generateInlineSchemaCode(response.inlineSchema);
		if (inlineInfo) {
			const isJson = response.contentType === "application/json";
			const parseMethod = isJson ? "response.json()" : "response.text()";

			validationCode.push(`\t\t// Parse and validate response body (inline schema)`);
			validationCode.push(`\t\tconst body = await ${parseMethod};`);
			validationCode.push(`\t\treturn ${inlineInfo.schemaCode}.parse(body);`);
		} else {
			const isJson = response.contentType === "application/json";
			const parseMethod = isJson ? "response.json()" : "response.text()";

			validationCode.push(`\t\t// Parse response body (inline schema type not yet supported for validation)`);
			validationCode.push(`\t\tconst body = await ${parseMethod};`);
			validationCode.push(`\t\treturn body;`);
		}
	} else if (response?.hasBody && !response.schemaName) {
		const isJson = response.contentType === "application/json";
		const parseMethod = isJson ? "response.json()" : "response.text()";

		validationCode.push(`\t\t// Parse response body (no schema validation available)`);
		validationCode.push(`\t\tconst body = await ${parseMethod};`);
		validationCode.push(`\t\treturn body;`);
	} else {
		validationCode.push(`\t\treturn;`);
	}

	// Build JSDoc tags
	const additionalTags: string[] = [];

	// Add content-type and status info
	const contentTypeInfo = requestContentType ? ` [${requestContentType}]` : "";
	const statusInfo = response ? ` (${statusCode})` : "";

	// Add @returns tag with response description if present
	if (response?.description) {
		additionalTags.push(`@returns ${response.description}`);
	}

	const jsdoc = generateOperationJSDoc({
		summary: endpoint.summary,
		description: endpoint.description,
		deprecated: endpoint.deprecated,
		method,
		path: `${path}${contentTypeInfo}${statusInfo}`,
		additionalTags,
	});

	return `${jsdoc}
	async ${finalMethodName}(${paramList}): ${returnType} {
${validationCode.join("\n")}
	}`;
}
