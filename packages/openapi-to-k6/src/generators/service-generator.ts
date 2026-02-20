import {
	deriveClassName,
	extractEndpoints,
	generateOperationJSDoc,
	getEndpointStats,
	normalizeSchemaTypeName,
	sanitizeParamName,
	toPascalCase,
	type EndpointInfo,
} from "@cerios/openapi-core";
import type { OpenAPISpec } from "@cerios/openapi-core";

import type { OpenApiK6GeneratorOptions } from "../types";

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

	// Request body parameter - normalize type name to match generated types (skip primitives)
	if (requestBody) {
		const normalizedBodyType = isPrimitiveType(requestBody.typeName)
			? requestBody.typeName
			: normalizeSchemaTypeName(requestBody.typeName);
		methodParams.push(`body${requestBody.required ? "" : "?"}: ${normalizedBodyType}`);
	}

	// K6 request parameters (always optional, always last)
	methodParams.push("requestParameters?: Params");

	// Determine response type - use actual type or unknown
	// Normalize schema type names to match generated types, but leave primitives as-is
	let responseType = "unknown";
	if (endpoint.successResponseType) {
		responseType = isPrimitiveType(endpoint.successResponseType)
			? endpoint.successResponseType
			: normalizeSchemaTypeName(endpoint.successResponseType);
	}
	const returnType = `K6ServiceResult<${responseType}>`;

	// Expected status code
	const expectedStatus = endpoint.successStatusCode || 200;

	// Generate JSDoc
	const jsdoc = generateOperationJSDoc({
		summary: endpoint.summary,
		description: endpoint.description,
		deprecated: endpoint.deprecated,
		method: endpoint.method,
		path: endpoint.path,
		includeDescriptions,
		returns: "K6ServiceResult with status check and parsed data",
	});

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
 * Collects all schema type names from endpoints (response types, request body types)
 * These are types that come from the OpenAPI schema definitions.
 * Normalizes names to ensure consistency with generated TypeScript types.
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
				// Normalize and handle array types - extract inner type for import
				const normalized = normalizeSchemaTypeName(endpoint.successResponseType);
				const innerType = normalized.endsWith("[]") ? normalized.slice(0, -2) : normalized;
				if (!isPrimitiveType(innerType)) {
					names.add(innerType);
				}
			}
		}
		// Collect request body type
		if (endpoint.requestBody?.typeName && endpoint.requestBody.typeName !== "unknown") {
			if (!isPrimitiveType(endpoint.requestBody.typeName)) {
				const normalized = normalizeSchemaTypeName(endpoint.requestBody.typeName);
				names.add(normalized);
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
	const endpoints = extractEndpoints(spec, {
		useOperationId: options.useOperationId,
		operationFilters: options.operationFilters,
		ignoreHeaders: options.ignoreHeaders,
		stripPathPrefix: options.stripPathPrefix,
		preferredContentTypes: options.preferredContentTypes,
		trackStatusCode: true,
	});

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
	return getEndpointStats(spec, {
		useOperationId: options.useOperationId,
		operationFilters: options.operationFilters,
		ignoreHeaders: options.ignoreHeaders,
		stripPathPrefix: options.stripPathPrefix,
		preferredContentTypes: options.preferredContentTypes,
	});
}
