/**
 * OpenAPI $ref resolution utilities
 *
 * Provides functions to resolve $ref references to component definitions
 * Supports: parameters, requestBodies, responses, schemas
 *
 * @internal Used by core and playwright packages
 */

import type { OpenAPIParameter, OpenAPIRequestBody, OpenAPIResponse, OpenAPISchema, OpenAPISpec } from "../types";

/**
 * Type for any resolvable component
 */
type ResolvableComponent = OpenAPIParameter | OpenAPIRequestBody | OpenAPIResponse | OpenAPISchema | any;

/**
 * Resolve a $ref to a component definition
 * Handles nested $refs by recursively resolving until no more refs found
 *
 * @param obj - Object that may contain a $ref
 * @param spec - The OpenAPI specification
 * @param maxDepth - Maximum recursion depth to prevent infinite loops (default: 10)
 * @returns The resolved component, or the original object if not a reference
 */
export function resolveRef<T extends ResolvableComponent>(obj: T | any, spec: OpenAPISpec, maxDepth = 10): T {
	if (!obj || typeof obj !== "object" || maxDepth <= 0) return obj;
	if (!obj.$ref) return obj;

	const ref = obj.$ref as string;
	let resolved: any = null;

	// Match different component types
	const paramMatch = ref.match(/^#\/components\/parameters\/(.+)$/);
	const requestBodyMatch = ref.match(/^#\/components\/requestBodies\/(.+)$/);
	const responseMatch = ref.match(/^#\/components\/responses\/(.+)$/);
	const schemaMatch = ref.match(/^#\/components\/schemas\/(.+)$/);

	if (paramMatch && spec.components?.parameters) {
		const name = paramMatch[1];
		resolved = spec.components.parameters[name];
	} else if (requestBodyMatch && spec.components?.requestBodies) {
		const name = requestBodyMatch[1];
		resolved = spec.components.requestBodies[name];
	} else if (responseMatch && spec.components?.responses) {
		const name = responseMatch[1];
		resolved = spec.components.responses[name];
	} else if (schemaMatch && spec.components?.schemas) {
		const name = schemaMatch[1];
		resolved = spec.components.schemas[name];
	}

	if (resolved) {
		// Recursively resolve nested $refs
		if (resolved.$ref) {
			return resolveRef(resolved, spec, maxDepth - 1);
		}
		return resolved;
	}

	// Return original if can't resolve
	return obj;
}

/**
 * Resolve a parameter reference
 * Convenience wrapper for resolveRef with parameter type
 */
export function resolveParameterRef(param: any, spec: OpenAPISpec): OpenAPIParameter | any {
	return resolveRef<OpenAPIParameter>(param, spec);
}

/**
 * Resolve a request body reference
 * Convenience wrapper for resolveRef with request body type
 */
export function resolveRequestBodyRef(requestBody: any, spec: OpenAPISpec): OpenAPIRequestBody | any {
	return resolveRef<OpenAPIRequestBody>(requestBody, spec);
}

/**
 * Resolve a response reference
 * Convenience wrapper for resolveRef with response type
 */
export function resolveResponseRef(response: any, spec: OpenAPISpec): OpenAPIResponse | any {
	return resolveRef<OpenAPIResponse>(response, spec);
}

/**
 * Merge path-level parameters with operation-level parameters
 * Operation parameters override path-level parameters with the same name and location
 *
 * @param pathParams - Parameters defined at the path level
 * @param operationParams - Parameters defined at the operation level
 * @param spec - The OpenAPI specification for resolving $refs
 * @returns Merged array of resolved parameters
 */
export function mergeParameters(
	pathParams: any[] | undefined,
	operationParams: any[] | undefined,
	spec: OpenAPISpec
): any[] {
	const resolvedPathParams = (pathParams || []).map(p => resolveParameterRef(p, spec));
	const resolvedOperationParams = (operationParams || []).map(p => resolveParameterRef(p, spec));

	// Start with path-level params
	const merged = [...resolvedPathParams];

	// Operation params override path params by name + in
	for (const opParam of resolvedOperationParams) {
		if (!opParam || typeof opParam !== "object") continue;

		const existingIndex = merged.findIndex(
			p => p && typeof p === "object" && p.name === opParam.name && p.in === opParam.in
		);

		if (existingIndex >= 0) {
			// Override existing param
			merged[existingIndex] = opParam;
		} else {
			// Add new param
			merged.push(opParam);
		}
	}

	return merged;
}
