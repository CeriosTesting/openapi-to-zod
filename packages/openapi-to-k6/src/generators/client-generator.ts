import type { OpenAPISpec } from "@cerios/openapi-core";
import {
	constructFullPath,
	deriveClassName,
	extractEndpoints,
	generateOperationJSDoc,
	getEndpointStats,
	normalizeBasePath,
	sanitizeParamName,
	toPascalCase,
	type EndpointInfo,
	type ParameterInfo,
} from "@cerios/openapi-core";

import type { OpenApiK6GeneratorOptions } from "../types";

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
	const jsdoc = generateOperationJSDoc({
		summary: endpoint.summary,
		description: endpoint.description,
		deprecated: endpoint.deprecated,
		method: endpoint.method,
		path: fullPath,
		includeDescriptions,
	});

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
 * Generates TypeScript types code for K6 client (parameter types)
 * Used when outputTypes is specified to generate types to a separate file
 */
export function generateK6TypesCode(spec: OpenAPISpec, options: OpenApiK6GeneratorOptions): string {
	const endpoints = extractEndpoints(spec, {
		useOperationId: options.useOperationId,
		operationFilters: options.operationFilters,
		ignoreHeaders: options.ignoreHeaders,
		stripPathPrefix: options.stripPathPrefix,
		preferredContentTypes: options.preferredContentTypes,
	});

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
 * @param warn - Optional warning function for non-fatal issues
 */
export function generateK6ClientCode(
	spec: OpenAPISpec,
	options: OpenApiK6GeneratorOptions,
	warn?: (message: string) => void
): string {
	const endpoints = extractEndpoints(spec, {
		useOperationId: options.useOperationId,
		operationFilters: options.operationFilters,
		ignoreHeaders: options.ignoreHeaders,
		stripPathPrefix: options.stripPathPrefix,
		preferredContentTypes: options.preferredContentTypes,
	});

	if (endpoints.length === 0) {
		// Warn if all operations were filtered out
		let totalOperations = 0;
		if (spec.paths) {
			for (const pathItem of Object.values(spec.paths)) {
				if (!pathItem || typeof pathItem !== "object") continue;
				const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
				for (const method of methods) {
					if (pathItem && typeof pathItem === "object" && method in pathItem) totalOperations++;
				}
			}
		}

		if (totalOperations > 0) {
			warn?.(`All ${totalOperations} operations were filtered out. Check your operationFilters configuration.`);
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
		importsCode += `\nimport { ${runtimeImports.join(", ")}, type QueryParams } from "@cerios/openapi-to-k6/runtime";`;
	} else {
		importsCode += `\nimport { ${runtimeImports.join(", ")} } from "@cerios/openapi-to-k6/runtime";`;
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
export function getClientEndpointStats(
	spec: OpenAPISpec,
	options: OpenApiK6GeneratorOptions
): { totalPaths: number; totalOperations: number; includedOperations: number } {
	return getEndpointStats(spec, {
		useOperationId: options.useOperationId,
		operationFilters: options.operationFilters,
		ignoreHeaders: options.ignoreHeaders,
		stripPathPrefix: options.stripPathPrefix,
		preferredContentTypes: options.preferredContentTypes,
	});
}
