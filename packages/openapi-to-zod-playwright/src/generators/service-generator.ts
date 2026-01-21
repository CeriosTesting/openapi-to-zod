import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import {
	type FallbackContentTypeParsing,
	getResponseParseMethod,
	mergeParameters,
	resolveRequestBodyRef,
	resolveResponseRef,
	stripPathPrefix,
	stripPrefix,
	toCamelCase,
	toPascalCase,
} from "@cerios/openapi-to-zod/internal";
import type { PlaywrightOperationFilters, ZodErrorFormat } from "../types";
import { selectContentType } from "../utils/content-type-selector";
import { shouldIgnoreHeader } from "../utils/header-filters";
import { extractPathParams, generateMethodName, sanitizeOperationId, sanitizeParamName } from "../utils/method-naming";
import { shouldIncludeOperation } from "../utils/operation-filters";
import { generateOperationJSDoc } from "../utils/operation-jsdoc";

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
 * Generate a type-safe API service class with response validation
 * Separate methods for each request content-type and status code combination
 * @param spec - OpenAPI specification
 * @param schemaImports - Set to collect schema import names
 * @param className - Name for the generated service class (default: "ApiService")
 * @param clientClassName - Name of the client class to inject (default: "ApiClient")
 * @param useOperationId - Whether to use operationId for method names
 * @param operationFilters - Optional operation filters to apply
 * @param ignoreHeaders - Optional array of header patterns to ignore
 * @param stripPrefix - Optional path prefix to strip before processing
 * @param stripSchemaPrefix - Optional schema name prefix to strip
 * @param preferredContentTypes - Optional array of preferred content types for response handling
 * @param prefix - Optional prefix for schema names
 * @param suffix - Optional suffix for schema names
 * @param fallbackContentTypeParsing - Fallback parsing method for unknown content types
 * @param validateServiceRequest - Whether to validate request inputs with Zod schemas
 * @param zodErrorFormat - Error formatting style for validation errors
 */
export function generateServiceClass(
	spec: OpenAPISpec,
	schemaImports: Set<string>,
	className: string = "ApiService",
	clientClassName: string = "ApiClient",
	useOperationId: boolean,
	operationFilters?: PlaywrightOperationFilters,
	ignoreHeaders?: string[],
	stripPrefix?: string,
	stripSchemaPrefix?: string,
	preferredContentTypes?: string[],
	prefix?: string,
	suffix?: string,
	fallbackContentTypeParsing?: FallbackContentTypeParsing,
	validateServiceRequest?: boolean,
	zodErrorFormat: ZodErrorFormat = "standard"
): string {
	const endpoints = extractEndpoints(
		spec,
		useOperationId,
		operationFilters,
		ignoreHeaders,
		stripPrefix,
		preferredContentTypes
	);

	if (endpoints.length === 0) {
		return "";
	}

	const methods = endpoints
		.flatMap(endpoint =>
			generateSuccessMethods(
				endpoint,
				schemaImports,
				ignoreHeaders,
				stripSchemaPrefix,
				prefix,
				suffix,
				fallbackContentTypeParsing,
				validateServiceRequest,
				zodErrorFormat
			)
		)
		.join("\n\n");

	// Build runtime imports based on error format
	const runtimeImports: string[] = [];
	if (zodErrorFormat === "prettify") {
		runtimeImports.push("parseWithPrettifyError");
	} else if (zodErrorFormat === "prettifyWithValues") {
		runtimeImports.push("parseWithPrettifyErrorWithValues");
	}

	const runtimeImportStatement =
		runtimeImports.length > 0
			? `import { ${runtimeImports.join(", ")} } from "@cerios/openapi-to-zod-playwright";\n`
			: "";

	return `${runtimeImportStatement}
/**
 * Type-safe API service with validation
 * Separate methods for each request content-type and status code
 * Response validation with Zod schemas
 */
export class ${className} {
	constructor(private readonly _client: ${clientClassName}) {}

${methods}
}`;
}

/**
 * Extracts all endpoints with their response information
 */
function extractEndpoints(
	spec: OpenAPISpec,
	useOperationId: boolean,
	operationFilters?: PlaywrightOperationFilters,
	ignoreHeaders?: string[],
	stripPrefix?: string,
	preferredContentTypes?: string[]
): EndpointInfo[] {
	const endpoints: EndpointInfo[] = [];

	if (!spec.paths) {
		return endpoints;
	}

	for (const [originalPath, pathItem] of Object.entries(spec.paths)) {
		if (!pathItem || typeof pathItem !== "object") continue;

		// Strip prefix from path for processing
		const path = stripPathPrefix(originalPath, stripPrefix);

		const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

		for (const method of methods) {
			const operation = pathItem[method];
			if (!operation) continue;

			// Apply operation filters
			if (operationFilters && !shouldIncludeOperation(operation, path, method, operationFilters)) {
				continue;
			}

			// Use operationId if useOperationId is true and operationId exists, otherwise generate from path
			// Sanitize operationId to ensure it's a valid TypeScript identifier
			const methodName =
				useOperationId && operation.operationId
					? sanitizeOperationId(operation.operationId)
					: generateMethodName(method, path);
			const pathParams = extractPathParams(path);

			const responses: ResponseInfo[] = [];

			if (operation.responses) {
				for (const [statusCode, rawResponseObj] of Object.entries(operation.responses)) {
					if (typeof rawResponseObj !== "object" || !rawResponseObj) continue;

					// Resolve $ref if present (e.g., $ref: '#/components/responses/SuccessResponse')
					const responseObj = resolveResponseRef(rawResponseObj, spec);
					if (!responseObj) continue;

					const status = Number.parseInt(statusCode, 10);
					const isSuccess = status >= 200 && status < 300;

					if (!isSuccess) continue;

					// Extract first content type only (Playwright handles content negotiation)
					const content = (responseObj as any).content;

					if (content && typeof content === "object") {
						// Get available content types and select based on preference
						const contentTypes = Object.keys(content);
						if (contentTypes.length > 0) {
							const rawContentType = selectContentType(contentTypes, preferredContentTypes);
							if (!rawContentType) continue;
							const contentObj = content[rawContentType];

							if (typeof contentObj === "object" && contentObj) {
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

			// Check if operation has query parameters (merge path-level and operation-level, resolve $refs)
			let queryParamSchemaName: string | undefined;
			const allParams = mergeParameters(pathItem.parameters, operation.parameters, spec);
			const hasQueryParams = allParams.some((param: any) => param && typeof param === "object" && param.in === "query");
			if (hasQueryParams) {
				// Generate schema name matching the base generator pattern
				// The base generator uses operationId if present, path+method fallback otherwise
				// We must use the same logic to reference the correct schema
				let pascalOperationId: string;
				if (operation.operationId) {
					// Use toPascalCase only for kebab-case IDs, simple capitalization for camelCase
					pascalOperationId = operation.operationId.includes("-")
						? toPascalCase(operation.operationId)
						: operation.operationId.charAt(0).toUpperCase() + operation.operationId.slice(1);
				} else {
					// Fallback: generate name from path + method (matches base generator's generateMethodNameFromPath)
					const methodName = generateMethodName(method, path);
					pascalOperationId = methodName.charAt(0).toUpperCase() + methodName.slice(1);
				}
				queryParamSchemaName = `${pascalOperationId}QueryParams`;
			}

			// Check if operation has header parameters (excluding ignored ones)
			let headerParamSchemaName: string | undefined;
			const hasHeaderParams = allParams.some(
				(param: any) =>
					param && typeof param === "object" && param.in === "header" && !shouldIgnoreHeader(param.name, ignoreHeaders)
			);
			if (hasHeaderParams) {
				// Generate schema name matching the base generator pattern
				// The base generator uses operationId if present, path+method fallback otherwise
				// We must use the same logic to reference the correct schema
				let pascalOperationId: string;
				if (operation.operationId) {
					// Use toPascalCase only for kebab-case IDs, simple capitalization for camelCase
					pascalOperationId = operation.operationId.includes("-")
						? toPascalCase(operation.operationId)
						: operation.operationId.charAt(0).toUpperCase() + operation.operationId.slice(1);
				} else {
					// Fallback: generate name from path + method (matches base generator's generateMethodNameFromPath)
					const methodName = generateMethodName(method, path);
					pascalOperationId = methodName.charAt(0).toUpperCase() + methodName.slice(1);
				}
				headerParamSchemaName = `${pascalOperationId}HeaderParams`;
			}

			// Resolve requestBody $ref if present (e.g., $ref: '#/components/requestBodies/UserBody')
			const resolvedRequestBody = operation.requestBody
				? resolveRequestBodyRef(operation.requestBody, spec)
				: undefined;

			endpoints.push({
				path,
				method: method.toUpperCase(),
				methodName,
				pathParams,
				parameters: operation.parameters,
				requestBody: resolvedRequestBody,
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
 * Creates one method per status code (content types are handled by using the first one)
 */
function generateSuccessMethods(
	endpoint: EndpointInfo,
	schemaImports: Set<string>,
	ignoreHeaders?: string[],
	stripSchemaPrefix?: string,
	prefix?: string,
	suffix?: string,
	fallbackContentTypeParsing?: FallbackContentTypeParsing,
	validateServiceRequest?: boolean,
	zodErrorFormat: ZodErrorFormat = "standard"
): string[] {
	const { responses } = endpoint;
	const methods: string[] = [];

	// No responses defined - generate single method
	if (responses.length === 0) {
		return [
			generateServiceMethod(
				endpoint,
				undefined,
				schemaImports,
				"",
				ignoreHeaders,
				stripSchemaPrefix,
				prefix,
				suffix,
				fallbackContentTypeParsing,
				validateServiceRequest,
				zodErrorFormat
			),
		];
	}

	// Group responses by status code
	const statusGroups = new Map<string, ResponseInfo>();
	for (const response of responses) {
		// Only keep the first response per status code (already filtered to first content type)
		if (!statusGroups.has(response.statusCode)) {
			statusGroups.set(response.statusCode, response);
		}
	}

	const hasMultipleStatuses = statusGroups.size > 1;

	for (const [statusCode, response] of statusGroups) {
		const statusSuffix = hasMultipleStatuses ? statusCode : "";
		methods.push(
			generateServiceMethod(
				endpoint,
				response,
				schemaImports,
				statusSuffix,
				ignoreHeaders,
				stripSchemaPrefix,
				prefix,
				suffix,
				fallbackContentTypeParsing,
				validateServiceRequest,
				zodErrorFormat
			)
		);
	}

	return methods;
}

/**
 * Generate Zod schema code for inline schemas (arrays, primitives)
 * Returns the schema code and type name
 */
function generateInlineSchemaCode(
	inlineSchema: any,
	stripSchemaPrefix?: string,
	prefix?: string,
	suffix?: string
): { schemaCode: string; typeName: string } | null {
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
		// Apply stripSchemaPrefix before converting to valid TypeScript identifiers
		const strippedName = stripPrefix(itemSchemaName, stripSchemaPrefix);
		// Apply prefix/suffix to match the generated schema names
		const itemSchemaVarName = toCamelCase(strippedName, { prefix, suffix });
		const itemTypeName = toPascalCase(strippedName);
		return {
			schemaCode: `z.array(${itemSchemaVarName}Schema)`,
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
 * Generate the parse call based on error format
 */
function generateParseCall(schemaVar: string, dataVar: string, format: ZodErrorFormat): string {
	if (format === "standard") {
		return `await ${schemaVar}.parseAsync(${dataVar})`;
	} else if (format === "prettify") {
		return `await parseWithPrettifyError(${schemaVar}, ${dataVar})`;
	} else {
		// prettifyWithValues
		return `await parseWithPrettifyErrorWithValues(${schemaVar}, ${dataVar})`;
	}
}

/**
 * Generates a single service method
 */
function generateServiceMethod(
	endpoint: EndpointInfo,
	response: ResponseInfo | undefined,
	schemaImports: Set<string>,
	statusSuffix: string,
	ignoreHeaders?: string[],
	stripSchemaPrefix?: string,
	prefix?: string,
	suffix?: string,
	fallbackContentTypeParsing?: FallbackContentTypeParsing,
	validateServiceRequest?: boolean,
	zodErrorFormat: ZodErrorFormat = "standard"
): string {
	const { path, method, methodName, pathParams, requestBody } = endpoint;

	// Determine method name - only status suffix if multiple status codes
	const finalMethodName = `${methodName}${statusSuffix}`;

	// Build parameter list
	const params: string[] = [];

	// Add path parameters
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		params.push(`${sanitized}: string`);
	}

	// Determine what parameters we need in options
	const hasQueryParams = endpoint.parameters?.some((p: any) => p.in === "query");
	const hasHeaderParams = endpoint.parameters?.some(
		(p: any) => p.in === "header" && !shouldIgnoreHeader(p.name, ignoreHeaders)
	);

	// Extract request content-type info if we have a request body (use first content type)
	let requestContentType = "";
	let hasRequestBody = false;
	if (requestBody?.content) {
		const firstContentType = Object.keys(requestBody.content)[0];
		if (firstContentType) {
			requestContentType = stripContentTypeParams(firstContentType);
			hasRequestBody = true;
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
				optionsProps.push("params?: QueryParams");
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
				optionsProps.push("headers?: HttpHeaders");
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
					// Apply stripSchemaPrefix before converting to valid TypeScript type name
					const strippedName = stripPrefix(schemaName, stripSchemaPrefix);
					const typeName = toPascalCase(strippedName);
					optionsProps.push(`data${optionalMarker}: ${typeName}`);
					schemaImports.add(schemaName);
				} else {
					optionsProps.push(`data${optionalMarker}: RequestBody`);
				}
			} else if (requestContentType === "application/x-www-form-urlencoded") {
				optionsProps.push(`form${optionalMarker}: UrlEncodedFormData | FormData`);
			} else if (requestContentType === "multipart/form-data") {
				optionsProps.push(`multipart${optionalMarker}: MultipartFormData`);
			} else {
				// Fallback for other content-types
				optionsProps.push(`data${optionalMarker}: RequestBody`);
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
	let returnTypeName: string | null = null; // For JSDoc @returns
	if (response?.hasBody && response.schemaName) {
		// Apply stripSchemaPrefix before converting to valid TypeScript type name
		const strippedName = stripPrefix(response.schemaName, stripSchemaPrefix);
		const typeName = toPascalCase(strippedName);
		returnType = `Promise<${typeName}>`;
		returnTypeName = typeName;
		schemaImports.add(response.schemaName);
	} else if (response?.hasBody && response.inlineSchema) {
		const inlineInfo = generateInlineSchemaCode(response.inlineSchema, stripSchemaPrefix);
		if (inlineInfo) {
			returnType = `Promise<${inlineInfo.typeName}>`;
			returnTypeName = inlineInfo.typeName;
		} else {
			returnType = "Promise<any>";
			returnTypeName = "any";
		}
	} else if (response?.hasBody && !response.schemaName) {
		returnType = "Promise<any>";
		returnTypeName = "any";
	}

	// Generate method body
	const statusCode = response?.statusCode || "200";
	const clientMethod = methodName;

	// Build client call with path params and options
	const pathParamArgs = pathParams.map(p => sanitizeParamName(p));
	const clientArgs =
		pathParamArgs.length > 0
			? needsOptions
				? `${pathParamArgs.join(", ")}, options`
				: pathParamArgs.join(", ")
			: needsOptions
				? "options"
				: "";

	// Build validation code
	const validationCode: string[] = [];

	// Add request validation if enabled
	if (validateServiceRequest) {
		// Validate query parameters
		if (hasQueryParams && endpoint.queryParamSchemaName) {
			const strippedQueryName = stripPrefix(endpoint.queryParamSchemaName, stripSchemaPrefix);
			const querySchemaVar = `${toCamelCase(strippedQueryName, { prefix, suffix })}Schema`;
			schemaImports.add(`${endpoint.queryParamSchemaName}Schema`);
			validationCode.push(`\t\t// Validate query parameters`);
			validationCode.push(`\t\tif (options?.params) {`);
			validationCode.push(`\t\t\t${generateParseCall(querySchemaVar, "options.params", zodErrorFormat)};`);
			validationCode.push(`\t\t}`);
			validationCode.push("");
		}

		// Validate header parameters
		if (hasHeaderParams && endpoint.headerParamSchemaName) {
			const strippedHeaderName = stripPrefix(endpoint.headerParamSchemaName, stripSchemaPrefix);
			const headerSchemaVar = `${toCamelCase(strippedHeaderName, { prefix, suffix })}Schema`;
			schemaImports.add(`${endpoint.headerParamSchemaName}Schema`);
			validationCode.push(`\t\t// Validate header parameters`);
			validationCode.push(`\t\tif (options?.headers) {`);
			validationCode.push(`\t\t\t${generateParseCall(headerSchemaVar, "options.headers", zodErrorFormat)};`);
			validationCode.push(`\t\t}`);
			validationCode.push("");
		}

		// Validate request body (only for application/json with a schema ref)
		if (hasRequestBody && requestContentType === "application/json") {
			const schema = requestBody.content[requestContentType]?.schema || requestBody.content["application/json"]?.schema;
			if (schema?.$ref) {
				const schemaName = schema.$ref.split("/").pop();
				const strippedBodyName = stripPrefix(schemaName, stripSchemaPrefix);
				const bodySchemaVar = `${toCamelCase(strippedBodyName, { prefix, suffix })}Schema`;
				schemaImports.add(`${schemaName}Schema`);
				const isRequired = requestBody.required === true;
				if (isRequired) {
					validationCode.push(`\t\t// Validate request body`);
					validationCode.push(`\t\t${generateParseCall(bodySchemaVar, "options.data", zodErrorFormat)};`);
					validationCode.push("");
				} else {
					validationCode.push(`\t\t// Validate request body`);
					validationCode.push(`\t\tif (options?.data !== undefined) {`);
					validationCode.push(`\t\t\t${generateParseCall(bodySchemaVar, "options.data", zodErrorFormat)};`);
					validationCode.push(`\t\t}`);
					validationCode.push("");
				}
			}
		}
	}

	// Add client call
	validationCode.push(`\t\tconst response = await this._client.${clientMethod}(${clientArgs});`);
	validationCode.push("");

	// Add status validation
	validationCode.push(`\t\t// Validate status code`);
	validationCode.push(`\t\texpect(response.status(), await response.text()).toBe(${statusCode});`);
	validationCode.push("");

	// Add response validation
	if (response?.hasBody && response.schemaName) {
		// Apply stripSchemaPrefix before converting to camelCase variable name
		const strippedName = stripPrefix(response.schemaName, stripSchemaPrefix);
		// Apply prefix/suffix to match the generated schema names
		const schemaVar = `${toCamelCase(strippedName, { prefix, suffix })}Schema`;

		// Determine parse method based on content type
		const parseResult = getResponseParseMethod(response.contentType, fallbackContentTypeParsing);
		if (parseResult.isUnknown) {
			console.warn(
				`[openapi-to-zod-playwright] Unknown content type "${response.contentType}" for ${endpoint.method} ${endpoint.path}, using fallback "${parseResult.method}"`
			);
		}

		let parseMethod: string;
		if (parseResult.method === "json") {
			parseMethod = "response.json()";
		} else if (parseResult.method === "text") {
			parseMethod = "response.text()";
		} else {
			parseMethod = "response.body()";
		}

		validationCode.push(`\t\t// Parse and validate response body`);
		validationCode.push(`\t\tconst body = await ${parseMethod};`);
		validationCode.push(`\t\treturn ${generateParseCall(schemaVar, "body", zodErrorFormat)};`);
	} else if (response?.hasBody && response.inlineSchema) {
		const inlineInfo = generateInlineSchemaCode(response.inlineSchema, stripSchemaPrefix, prefix, suffix);
		if (inlineInfo) {
			// Determine parse method based on content type
			const parseResult = getResponseParseMethod(response.contentType, fallbackContentTypeParsing);
			if (parseResult.isUnknown) {
				console.warn(
					`[openapi-to-zod-playwright] Unknown content type "${response.contentType}" for ${endpoint.method} ${endpoint.path}, using fallback "${parseResult.method}"`
				);
			}

			let parseMethod: string;
			if (parseResult.method === "json") {
				parseMethod = "response.json()";
			} else if (parseResult.method === "text") {
				parseMethod = "response.text()";
			} else {
				parseMethod = "response.body()";
			}

			validationCode.push(`\t\t// Parse and validate response body (inline schema)`);
			validationCode.push(`\t\tconst body = await ${parseMethod};`);
			validationCode.push(`\t\treturn ${generateParseCall(inlineInfo.schemaCode, "body", zodErrorFormat)};`);
		} else {
			// Determine parse method based on content type
			const parseResult = getResponseParseMethod(response.contentType, fallbackContentTypeParsing);
			if (parseResult.isUnknown) {
				console.warn(
					`[openapi-to-zod-playwright] Unknown content type "${response.contentType}" for ${endpoint.method} ${endpoint.path}, using fallback "${parseResult.method}"`
				);
			}

			let parseMethod: string;
			if (parseResult.method === "json") {
				parseMethod = "response.json()";
			} else if (parseResult.method === "text") {
				parseMethod = "response.text()";
			} else {
				parseMethod = "response.body()";
			}

			validationCode.push(`\t\t// Parse response body (inline schema type not yet supported for validation)`);
			validationCode.push(`\t\tconst body = await ${parseMethod};`);
			validationCode.push(`\t\treturn body;`);
		}
	} else if (response?.hasBody && !response.schemaName) {
		// Determine parse method based on content type
		const parseResult = getResponseParseMethod(response.contentType, fallbackContentTypeParsing);
		if (parseResult.isUnknown) {
			console.warn(
				`[openapi-to-zod-playwright] Unknown content type "${response.contentType}" for ${endpoint.method} ${endpoint.path}, using fallback "${parseResult.method}"`
			);
		}

		let parseMethod: string;
		if (parseResult.method === "json") {
			parseMethod = "response.json()";
		} else if (parseResult.method === "text") {
			parseMethod = "response.text()";
		} else {
			parseMethod = "response.body()";
		}

		validationCode.push(`\t\t// Parse response body (no schema validation available)`);
		validationCode.push(`\t\tconst body = await ${parseMethod};`);
		validationCode.push(`\t\treturn body;`);
	}
	// Note: No else clause - void methods don't need a return statement

	// Build JSDoc tags
	const additionalTags: string[] = [];

	// Add content-type and status info
	const contentTypeInfo = requestContentType ? ` [${requestContentType}]` : "";
	const statusInfo = response ? ` (${statusCode})` : "";

	// Add @returns tag ONLY if there's a body with a meaningful return type
	if (response?.hasBody && returnTypeName) {
		additionalTags.push(`@returns ${returnTypeName}`);
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
