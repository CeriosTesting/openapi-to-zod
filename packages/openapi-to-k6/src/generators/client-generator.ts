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
 * Normalizes a base path by ensuring it has a leading slash and no trailing slash
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
 */
function constructFullPath(basePath: string | undefined, path: string): string {
	if (!basePath) {
		return path;
	}

	let normalizedPath = path.trim();
	if (!normalizedPath.startsWith("/")) {
		normalizedPath = `/${normalizedPath}`;
	}

	return basePath + normalizedPath;
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
 * Check if a property name needs to be quoted in TypeScript interface
 * Invalid identifiers include names with special characters like brackets, dashes, etc.
 */
function needsQuoting(propName: string): boolean {
	// Valid identifier: starts with letter/underscore/$, followed by letters/digits/underscores/$
	const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
	return !validIdentifier.test(propName);
}

/**
 * Format property name for TypeScript interface (quote if needed)
 */
function formatPropertyName(propName: string): string {
	return needsQuoting(propName) ? `"${propName}"` : propName;
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
 * Extracts all endpoints from OpenAPI spec
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

			// Extract success response type
			let successResponseType: string | undefined;
			if (operation.responses) {
				for (const [statusCode, responseRef] of Object.entries(operation.responses)) {
					// Only consider 2xx responses
					if (!statusCode.startsWith("2")) continue;

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
				deprecated: operation.deprecated,
				summary: operation.summary,
				description: operation.description,
			});
		}
	}

	return endpoints;
}

/**
 * Generates TypeScript type for query parameters
 */
function generateParamsType(methodName: string, params: ParameterInfo[]): string {
	if (params.length === 0) return "";

	const typeName = `${toPascalCase(methodName)}Params`;
	const props = params
		.map(p => {
			const comment = p.description ? `  /** ${p.description} */\n` : "";
			const propName = formatPropertyName(p.name);
			return `${comment}  ${propName}${p.required ? "" : "?"}: ${p.type};`;
		})
		.join("\n");

	return `export type ${typeName} = {\n${props}\n};`;
}

/**
 * Generates TypeScript type for header parameters
 */
function generateHeadersType(methodName: string, params: ParameterInfo[]): string {
	if (params.length === 0) return "";

	const typeName = `${toPascalCase(methodName)}Headers`;
	const props = params
		.map(p => {
			const comment = p.description ? `  /** ${p.description} */\n` : "";
			// Use formatPropertyName to quote when needed (headers often contain dashes)
			const propName = formatPropertyName(p.name);
			return `${comment}  ${propName}${p.required ? "" : "?"}: ${p.type};`;
		})
		.join("\n");

	return `export type ${typeName} = {\n${props}\n};`;
}

/**
 * Generates JSDoc comment for a method
 */
function generateMethodJSDoc(endpoint: EndpointInfo, fullPath: string, includeDescriptions: boolean): string {
	const lines: string[] = ["/**"];

	if (endpoint.summary && includeDescriptions) {
		lines.push(` * @summary ${endpoint.summary}`);
	}

	if (endpoint.description && includeDescriptions) {
		// Split long descriptions into multiple lines
		const descLines = endpoint.description.split("\n");
		lines.push(` * @description ${descLines[0]}`);
		for (let i = 1; i < descLines.length; i++) {
			lines.push(` * ${descLines[i]}`);
		}
	}

	if (endpoint.deprecated) {
		lines.push(" * @deprecated");
	}

	lines.push(` * @method ${endpoint.method.toUpperCase()} ${fullPath}`);
	lines.push(" */");

	return lines.join("\n  ");
}

/**
 * Generates a single client method - pure passthrough to K6
 * Only uses K6 native types (Params, Response, RequestBody)
 */
function generateClientMethod(
	endpoint: EndpointInfo,
	basePath: string | undefined,
	includeDescriptions: boolean
): string {
	const { path, method, methodName, pathParams, queryParams, requestBody } = endpoint;

	const hasQueryParams = queryParams.length > 0;
	const hasRequestBody = !!requestBody;

	// Build method parameters - only path params and options object
	const methodParams: string[] = [];

	// Path parameters (always required, always first)
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		methodParams.push(`${sanitized}: string`);
	}

	// Build options object type - only include properties that are actually needed
	const optionsProperties: string[] = [];
	if (hasQueryParams) {
		optionsProperties.push("params?: QueryParams");
	}
	optionsProperties.push("requestParameters?: Params");
	if (hasRequestBody) {
		optionsProperties.push("body?: RequestBody | null");
	}

	// Only add options parameter if there are any optional properties
	if (optionsProperties.length > 0) {
		methodParams.push(`options?: {\n    ${optionsProperties.join(";\n    ")};\n  }`);
	}

	// Determine response type - client returns raw Response
	const returnType = "Response";

	// Build full path with base path
	const fullPath = constructFullPath(basePath, path);

	// Build URL template with path parameter interpolation
	let urlTemplate = fullPath;
	for (const param of pathParams) {
		const sanitized = sanitizeParamName(param);
		urlTemplate = urlTemplate.replace(`{${param}}`, `\${${sanitized}}`);
	}

	// Generate JSDoc
	const jsdoc = generateMethodJSDoc(endpoint, fullPath, includeDescriptions);

	// Build method body
	const httpMethod = method.toUpperCase();

	// URL construction - only call buildQueryString if endpoint has query params
	const urlConstruction = hasQueryParams
		? `const url = this.baseUrl + \`${urlTemplate}\` + buildQueryString(options?.params);`
		: `const url = this.baseUrl + \`${urlTemplate}\`;`;

	// Body value - only reference options?.body if endpoint has request body
	const bodyValue = hasRequestBody ? "options?.body" : "null";

	// Content-Type header - only include if endpoint has request body
	const contentTypeHeader = requestBody ? `"Content-Type": "${requestBody.contentType}",\n        ` : "";

	return `  ${jsdoc}
  ${methodName}(${methodParams.join(", ")}): ${returnType} {
    ${urlConstruction}
    const mergedParams = mergeRequestParameters(
      options?.requestParameters || {},
      this.commonRequestParameters
    );

    return http.request("${httpMethod}", url, ${bodyValue}, {
      ...mergedParams,
      headers: {
        ${contentTypeHeader}...mergedParams?.headers,
      },
    });
  }`;
}

/**
 * Derives a class name from output file path
 */
function deriveClassName(outputPath: string): string {
	const fileName = outputPath.split("/").pop()?.split("\\").pop() || "ApiClient";
	const baseName = fileName.replace(/\.(ts|js)$/, "");

	// Convert to PascalCase
	const pascalCase = baseName
		.split(/[-_\s]+/)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");

	return pascalCase;
}

/**
 * Generates TypeScript types code for K6 client (parameter types)
 * Used when outputTypes is specified to generate types to a separate file
 */
export function generateK6TypesCode(spec: OpenAPISpec, options: OpenApiK6GeneratorOptions): string {
	const endpoints = extractEndpoints(spec, options);

	if (endpoints.length === 0) {
		return "";
	}

	// Collect all unique types
	const types: string[] = [];
	for (const endpoint of endpoints) {
		const paramsType = generateParamsType(endpoint.methodName, endpoint.queryParams);
		if (paramsType) types.push(paramsType);

		const headersType = generateHeadersType(endpoint.methodName, endpoint.headerParams);
		if (headersType) types.push(headersType);
	}

	if (types.length === 0) {
		return "";
	}

	return `${types.join("\n\n")}\n`;
}

/**
 * Generates the complete K6 client code
 * @param spec - OpenAPI specification
 * @param options - Generator options
 * @param typesImportPath - Optional relative import path for types (when using separate types file)
 */
export function generateK6ClientCode(spec: OpenAPISpec, options: OpenApiK6GeneratorOptions): string {
	const endpoints = extractEndpoints(spec, options);

	if (endpoints.length === 0) {
		// Warn if all operations were filtered out
		let totalOperations = 0;
		if (spec.paths) {
			for (const pathItem of Object.values(spec.paths)) {
				if (!pathItem || typeof pathItem !== "object") continue;
				const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
				for (const method of methods) {
					if ((pathItem as any)[method]) totalOperations++;
				}
			}
		}

		if (totalOperations > 0) {
			console.warn(
				`⚠️  Warning: All ${totalOperations} operations were filtered out. Check your operationFilters configuration.`
			);
		}

		return "";
	}

	const className = deriveClassName(options.outputClient);
	const normalizedBasePath = normalizeBasePath(options.basePath);
	const includeDescriptions = options.includeDescriptions ?? true;

	// Check what features are needed across all endpoints
	const hasAnyQueryParams = endpoints.some(e => e.queryParams.length > 0);
	const hasAnyRequestBody = endpoints.some(e => !!e.requestBody);

	// Client is a pure passthrough layer - NO generated types
	// Only uses K6 native types (Params, Response, RequestBody)

	// Generate methods
	const methods = endpoints
		.map(endpoint => generateClientMethod(endpoint, normalizedBasePath, includeDescriptions))
		.join("\n\n");

	// Build the complete file
	const parts: string[] = [];

	// Build K6 type imports - only include what's needed
	const k6Types = ["Params", "Response"];
	if (hasAnyRequestBody) {
		k6Types.push("RequestBody");
	}

	// Build runtime imports - only include what's needed
	const runtimeImports = ["cleanBaseUrl", "mergeRequestParameters"];
	if (hasAnyQueryParams) {
		runtimeImports.unshift("buildQueryString");
	}

	// Imports - only K6 types and runtime utilities (NO generated types)
	let importsCode = `import http from "k6/http";
import type { ${k6Types.join(", ")} } from "k6/http";`;

	if (hasAnyQueryParams) {
		importsCode += `\nimport { ${runtimeImports.join(", ")}, type QueryParams } from "@cerios/openapi-to-k6";`;
	} else {
		importsCode += `\nimport { ${runtimeImports.join(", ")} } from "@cerios/openapi-to-k6";`;
	}

	parts.push(importsCode);

	// Client class
	parts.push(`
/**
 * K6 HTTP client for API testing
 * Generated from OpenAPI specification
 *
 * This is a thin passthrough layer - no response parsing or validation.
 * Returns raw K6 Response objects. Use the Service class for typed responses.
 */
export class ${className} {
  private readonly baseUrl: string;
  private readonly commonRequestParameters: Params;

  /**
   * Creates a new API client instance
   * @param baseUrl - Base URL for all API requests (trailing slash will be removed)
   * @param commonRequestParameters - Common K6 request parameters applied to all requests
   */
  constructor(baseUrl: string, commonRequestParameters: Params = {}) {
    this.baseUrl = cleanBaseUrl(baseUrl);
    this.commonRequestParameters = commonRequestParameters;
  }

${methods}
}`);

	return parts.join("\n");
}

/**
 * Returns statistics about endpoints
 */
export function getEndpointStats(
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
