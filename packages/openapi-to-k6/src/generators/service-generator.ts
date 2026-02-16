import type { OpenAPISpec } from "@cerios/openapi-core";
import {
	extractPathParams,
	filterHeaders,
	generateHttpMethodName as generateMethodName,
	mergeParameters,
	resolveRequestBodyRef,
	resolveResponseRef,
	sanitizeOperationId,
	sanitizeParamName,
	shouldIncludeOperation,
	stripPathPrefix,
	toPascalCase,
} from "@cerios/openapi-core";

import type { OpenApiK6GeneratorOptions } from "../types";

interface ParameterInfo {
	name: string;
	required: boolean;
	type: string;
	description?: string;
}

interface EndpointInfo {
	path: string;
	method: string;
	methodName: string;
	pathParams: string[];
	queryParams: ParameterInfo[];
	headerParams: ParameterInfo[];
	requestBody?: RequestBodyInfo;
	successResponseType?: string;
	successStatusCode?: number;
	deprecated?: boolean;
	summary?: string;
	description?: string;
}

interface RequestBodyInfo {
	required: boolean;
	contentType: string;
	typeName: string;
}

/**
 * Converts OpenAPI schema type to TypeScript type
 */
function schemaToTypeString(schema: any): string {
	if (!schema) return "unknown";

	if (schema.$ref) {
		// Extract type name from ref
		const parts = schema.$ref.split("/");
		return parts[parts.length - 1];
	}

	switch (schema.type) {
		case "integer":
		case "number":
			return "number";
		case "boolean":
			return "boolean";
		case "string":
			if (schema.enum) {
				return schema.enum.map((v: string) => `"${v}"`).join(" | ");
			}
			return "string";
		case "array":
			return `${schemaToTypeString(schema.items)}[]`;
		case "object":
			if (schema.additionalProperties) {
				return `Record<string, ${schemaToTypeString(schema.additionalProperties)}>`;
			}
			return "Record<string, unknown>";
		default:
			return "unknown";
	}
}

/**
 * Selects the best content type from available options
 */
function selectContentType(available: string[], preferred: string[]): string | undefined {
	for (const pref of preferred) {
		if (available.includes(pref)) return pref;
	}
	return available[0];
}

/**
 * Extracts all endpoints from OpenAPI spec (for service generation)
 */
function extractEndpoints(spec: OpenAPISpec, options: OpenApiK6GeneratorOptions): EndpointInfo[] {
	const endpoints: EndpointInfo[] = [];
	const preferredContentTypes = options.preferredContentTypes || ["application/json"];

	if (!spec.paths) {
		return endpoints;
	}

	for (const [originalPath, pathItem] of Object.entries(spec.paths)) {
		if (!pathItem || typeof pathItem !== "object") continue;

		// Cast pathItem to access OpenAPI properties
		const pathItemObj = pathItem as Record<string, any>;

		// Strip prefix from path for processing
		const path = stripPathPrefix(originalPath, options.stripPathPrefix);

		const methods = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

		for (const method of methods) {
			const operation = pathItemObj[method];
			if (!operation) continue;

			// Apply operation filters
			if (!shouldIncludeOperation(operation, path, method, options.operationFilters)) {
				continue;
			}

			// Generate method name
			const methodName =
				options.useOperationId && operation.operationId
					? sanitizeOperationId(operation.operationId)
					: generateMethodName(method, path);

			// Extract path parameters
			const pathParams = extractPathParams(path);

			// Merge and extract parameters
			const mergedParams = mergeParameters(pathItemObj.parameters, operation.parameters, spec);

			// Extract query parameters
			const queryParams: ParameterInfo[] = mergedParams
				.filter(p => p.in === "query")
				.map(p => ({
					name: p.name,
					required: p.required || false,
					type: schemaToTypeString(p.schema),
					description: p.description,
				}));

			// Extract header parameters (filtered by ignoreHeaders)
			const headerParams: ParameterInfo[] = filterHeaders(
				mergedParams.filter(p => p.in === "header"),
				options.ignoreHeaders
			).map(p => ({
				name: p.name,
				required: p.required || false,
				type: schemaToTypeString(p.schema),
				description: p.description,
			}));

			// Extract request body info
			let requestBody: RequestBodyInfo | undefined;
			if (operation.requestBody) {
				const resolved = resolveRequestBodyRef(operation.requestBody, spec);

				if (resolved?.content) {
					const contentType = selectContentType(Object.keys(resolved.content), preferredContentTypes);
					if (contentType) {
						const mediaType = resolved.content[contentType];
						requestBody = {
							required: resolved.required || false,
							contentType,
							typeName: mediaType?.schema ? schemaToTypeString(mediaType.schema) : "unknown",
						};
					}
				}
			}

			// Extract success response type and status code
			let successResponseType: string | undefined;
			let successStatusCode: number | undefined;
			if (operation.responses) {
				for (const [statusCode, responseRef] of Object.entries(operation.responses)) {
					// Only consider 2xx responses
					if (!statusCode.startsWith("2")) continue;

					successStatusCode = parseInt(statusCode, 10);

					const resolved = resolveResponseRef(responseRef, spec);
					if (resolved?.content) {
						const contentType = selectContentType(Object.keys(resolved.content), preferredContentTypes);
						if (contentType) {
							const mediaType = resolved.content[contentType];
							if (mediaType?.schema) {
								successResponseType = schemaToTypeString(mediaType.schema);
								break; // Use first matching success response
							}
						}
					} else {
						// Response with no content (e.g., 204 No Content)
						successResponseType = "void";
						break;
					}
				}
			}

			endpoints.push({
				path,
				method,
				methodName,
				pathParams,
				queryParams,
				headerParams,
				requestBody,
				successResponseType,
				successStatusCode,
				deprecated: operation.deprecated,
				summary: operation.summary,
				description: operation.description,
			});
		}
	}

	return endpoints;
}

/**
 * Generates JSDoc comment for a service method
 */
function generateMethodJSDoc(endpoint: EndpointInfo, includeDescriptions: boolean): string {
	const lines: string[] = ["/**"];

	if (endpoint.summary && includeDescriptions) {
		lines.push(` * @summary ${endpoint.summary}`);
	}

	if (endpoint.description && includeDescriptions) {
		const descLines = endpoint.description.split("\n");
		lines.push(` * @description ${descLines[0]}`);
		for (let i = 1; i < descLines.length; i++) {
			lines.push(` * ${descLines[i]}`);
		}
	}

	if (endpoint.deprecated) {
		lines.push(" * @deprecated");
	}

	lines.push(` * @method ${endpoint.method.toUpperCase()} ${endpoint.path}`);
	lines.push(` * @returns K6ServiceResult with status check and parsed data`);
	lines.push(" */");

	return lines.join("\n  ");
}

/**
 * Generates a single service method
 */
function generateServiceMethod(endpoint: EndpointInfo, includeDescriptions: boolean): string {
	const { methodName, pathParams, queryParams, headerParams, requestBody } = endpoint;

	// Build method parameters - service uses typed parameters
	const methodParams: string[] = [];

	// Path parameters (always required, always first)
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		methodParams.push(`${sanitized}: string`);
	}

	// Headers parameter (if any header params exist)
	if (headerParams.length > 0) {
		const headersTypeName = `${toPascalCase(methodName)}Headers`;
		const allRequired = headerParams.every(h => h.required);
		methodParams.push(`headers${allRequired ? "" : "?"}: ${headersTypeName}`);
	}

	// Query params parameter (if any query params exist)
	if (queryParams.length > 0) {
		const paramsTypeName = `${toPascalCase(methodName)}Params`;
		const allRequired = queryParams.every(q => q.required);
		methodParams.push(`params${allRequired ? "" : "?"}: ${paramsTypeName}`);
	}

	// Request body parameter
	if (requestBody) {
		methodParams.push(`body${requestBody.required ? "" : "?"}: ${requestBody.typeName}`);
	}

	// K6 request parameters (always optional, always last)
	methodParams.push("requestParameters?: Params");

	// Determine response type - use actual type or unknown
	const responseType = endpoint.successResponseType || "unknown";
	const returnType = `K6ServiceResult<${responseType}>`;

	// Expected status code
	const expectedStatus = endpoint.successStatusCode || 200;

	// Generate JSDoc
	const jsdoc = generateMethodJSDoc(endpoint, includeDescriptions);

	// Build client call - client takes path params + options object
	const pathParamArgs = pathParams.map(p => sanitizeParamName(p)).join(", ");

	// Build options object for client call
	const optionParts: string[] = [];
	if (queryParams.length > 0) {
		optionParts.push("params");
	}
	optionParts.push("requestParameters");
	if (requestBody) {
		optionParts.push("body: serializeBody(body)");
	}

	const clientOptions = `{ ${optionParts.join(", ")} }`;
	const clientCall = pathParamArgs
		? `this._client.${methodName}(${pathParamArgs}, ${clientOptions})`
		: `this._client.${methodName}(${clientOptions})`;

	// Build data extraction based on response type
	let dataExtraction: string;
	if (responseType === "void") {
		dataExtraction = "const data = undefined as void;";
	} else {
		dataExtraction = `const data = response.json() as ${responseType};`;
	}

	// Build header merging code if endpoint has header params
	let headerMergeCode = "";
	if (headerParams.length > 0) {
		headerMergeCode = `    // Merge headers into request parameters
    if (!requestParameters) {
      requestParameters = {};
    }
    requestParameters.headers = { ...(requestParameters.headers || {}), ...headers };

`;
	}

	return `  ${jsdoc}
  ${methodName}(${methodParams.join(", ")}): ${returnType} {
${headerMergeCode}    const response = ${clientCall};

    // Validate status code
    const ok = check(response, {
      "${methodName} status is ${expectedStatus}": (r) => {
        if (r.status !== ${expectedStatus}) {
          console.log(\`${methodName} failed with status: \${r.status}, body: \${r.body}\`);
        }
        return r.status === ${expectedStatus};
      },
    });

    ${dataExtraction}
    return { response, data, ok };
  }`;
}

/**
 * Derives a class name from output file path
 */
function deriveClassName(outputPath: string, suffix: string): string {
	const fileName = outputPath.split("/").pop()?.split("\\").pop() || "Api";
	const baseName = fileName.replace(/\.(ts|js)$/, "");

	// Convert to PascalCase
	const pascalCase = baseName
		.split(/[-_\s]+/)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");

	// Remove existing suffix if present to avoid duplication
	const cleanName = pascalCase.replace(/Service$/i, "").replace(/Client$/i, "");

	return cleanName + suffix;
}

/**
 * Collects all schema type names from endpoints (response types, request body types)
 * These are types that come from the OpenAPI schema definitions
 */
function collectSchemaTypeNames(endpoints: EndpointInfo[]): string[] {
	const names = new Set<string>();
	for (const endpoint of endpoints) {
		// Collect response type
		if (
			endpoint.successResponseType &&
			endpoint.successResponseType !== "unknown" &&
			endpoint.successResponseType !== "void"
		) {
			// Only add if it looks like a type name (not a primitive like "string" or "number")
			if (!isPrimitiveType(endpoint.successResponseType)) {
				names.add(endpoint.successResponseType);
			}
		}
		// Collect request body type
		if (endpoint.requestBody?.typeName && endpoint.requestBody.typeName !== "unknown") {
			if (!isPrimitiveType(endpoint.requestBody.typeName)) {
				names.add(endpoint.requestBody.typeName);
			}
		}
	}
	return Array.from(names);
}

/**
 * Collects all interface type names from endpoints (Params/Headers)
 */
function collectParamInterfaceNames(endpoints: EndpointInfo[]): string[] {
	const names: string[] = [];
	for (const endpoint of endpoints) {
		if (endpoint.queryParams.length > 0) {
			names.push(`${toPascalCase(endpoint.methodName)}Params`);
		}
		if (endpoint.headerParams.length > 0) {
			names.push(`${toPascalCase(endpoint.methodName)}Headers`);
		}
	}
	return names;
}

/**
 * Check if a type is a primitive type (not a schema type that needs importing)
 */
function isPrimitiveType(typeName: string): boolean {
	const primitives = ["string", "number", "boolean", "unknown", "any", "void", "null", "undefined", "never", "object"];
	// Check for simple primitives
	if (primitives.includes(typeName)) return true;
	// Check for array of primitives like "string[]"
	if (typeName.endsWith("[]")) {
		return isPrimitiveType(typeName.slice(0, -2));
	}
	// Check for Record types
	if (typeName.startsWith("Record<")) return true;
	// Check for union of string literals like '"value1" | "value2"'
	if (typeName.includes('"')) return true;
	return false;
}

/**
 * Generates the complete K6 service code
 * @param spec - OpenAPI specification
 * @param options - Generator options
 * @param clientImportPath - Relative import path for the client
 * @param typesImportPath - Relative import path for types
 */
export function generateK6ServiceCode(
	spec: OpenAPISpec,
	options: OpenApiK6GeneratorOptions,
	clientImportPath: string,
	typesImportPath: string
): string {
	const endpoints = extractEndpoints(spec, options);

	if (endpoints.length === 0) {
		return "";
	}

	const clientClassName = deriveClassName(options.outputClient, "Client");
	const serviceClassName = deriveClassName(options.outputService || "service", "Service");
	const includeDescriptions = options.includeDescriptions ?? true;

	// Collect type names for imports
	const paramInterfaceNames = collectParamInterfaceNames(endpoints);
	const schemaTypeNames = collectSchemaTypeNames(endpoints);

	// Generate methods
	const methods = endpoints.map(endpoint => generateServiceMethod(endpoint, includeDescriptions)).join("\n\n");

	// Build the complete file
	const parts: string[] = [];

	// Check if any endpoint has a request body (needs serializeBody import)
	const hasAnyRequestBody = endpoints.some(e => !!e.requestBody);

	// Imports
	const k6RuntimeImports = hasAnyRequestBody ? "K6ServiceResult, serializeBody" : "K6ServiceResult";
	parts.push(`import { check } from "k6";
import type { Params } from "k6/http";
import { type ${k6RuntimeImports} } from "@cerios/openapi-to-k6";
import { ${clientClassName} } from "${clientImportPath}";`);

	// Import types from types file
	const allTypeNames = [...paramInterfaceNames, ...schemaTypeNames];
	if (allTypeNames.length > 0) {
		parts.push(`import type { ${allTypeNames.join(", ")} } from "${typesImportPath}";`);
	}

	// Service class
	parts.push(`
/**
 * K6 API service with status code validation
 * Generated from OpenAPI specification
 *
 * Wraps the client methods with:
 * - Status code checking using K6's check() function
 * - Response body parsing
 * - K6ServiceResult return type with ok flag
 */
export class ${serviceClassName} {
  private readonly _client: ${clientClassName};

  /**
   * Creates a new API service instance
   * @param client - The K6 client instance to wrap
   */
  constructor(client: ${clientClassName}) {
    this._client = client;
  }

${methods}
}`);

	return parts.join("\n");
}

/**
 * Returns statistics about service endpoints
 */
export function getServiceEndpointStats(
	spec: OpenAPISpec,
	options: OpenApiK6GeneratorOptions
): { totalPaths: number; totalOperations: number; includedOperations: number } {
	let totalPaths = 0;
	let totalOperations = 0;

	if (spec.paths) {
		totalPaths = Object.keys(spec.paths).length;

		for (const pathItem of Object.values(spec.paths)) {
			if (!pathItem || typeof pathItem !== "object") continue;
			const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
			for (const method of methods) {
				if ((pathItem as any)[method]) totalOperations++;
			}
		}
	}

	const endpoints = extractEndpoints(spec, options);

	return {
		totalPaths,
		totalOperations,
		includedOperations: endpoints.length,
	};
}
