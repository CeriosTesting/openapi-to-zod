/**
 * Schema traversal utilities for OpenAPI specifications.
 * Provides functions for analyzing schema dependencies, detecting circular references,
 * and performing topological sorting.
 */

import type { OpenAPISchema, OpenAPISpec } from "../types";

import { resolveRefName } from "./name-utils";

/**
 * Schema context indicating where a schema is used
 */
export type SchemaContext = "request" | "response" | "both";

/**
 * Result of schema usage analysis
 */
export interface SchemaUsageAnalysis {
	/** Map of schema names to their usage context */
	usageMap: Map<string, SchemaContext>;
	/** Set of schema names involved in circular references */
	circularSchemas: Set<string>;
	/** Set of schema names used in request contexts */
	requestSchemas: Set<string>;
	/** Set of schema names used in response contexts */
	responseSchemas: Set<string>;
}

/**
 * Extract all $ref names from a schema tree
 * @param schema The schema to extract refs from
 * @param refs Set to collect ref names into (mutated)
 */
export function extractSchemaRefs(schema: OpenAPISchema | undefined, refs: Set<string>): void {
	if (!schema) return;

	if (schema.$ref) {
		const refName = resolveRefName(schema.$ref);
		refs.add(refName);
	}

	if (schema.allOf) {
		for (const subSchema of schema.allOf) {
			extractSchemaRefs(subSchema, refs);
		}
	}

	if (schema.oneOf) {
		for (const subSchema of schema.oneOf) {
			extractSchemaRefs(subSchema, refs);
		}
	}

	if (schema.anyOf) {
		for (const subSchema of schema.anyOf) {
			extractSchemaRefs(subSchema, refs);
		}
	}

	if (schema.items) {
		extractSchemaRefs(schema.items, refs);
	}

	if (schema.prefixItems) {
		for (const item of schema.prefixItems) {
			extractSchemaRefs(item, refs);
		}
	}

	if (schema.properties) {
		for (const prop of Object.values(schema.properties)) {
			extractSchemaRefs(prop, refs);
		}
	}

	if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
		extractSchemaRefs(schema.additionalProperties, refs);
	}

	if (schema.not) {
		extractSchemaRefs(schema.not, refs);
	}

	if (schema.if) {
		extractSchemaRefs(schema.if, refs);
	}
	if (schema.then) {
		extractSchemaRefs(schema.then, refs);
	}
	if (schema.else) {
		extractSchemaRefs(schema.else, refs);
	}
}

/**
 * Expand a set of schema names to include all transitively referenced schemas
 * @param schemaNames Initial set of schema names (mutated to include transitive refs)
 * @param spec OpenAPI specification
 */
export function expandTransitiveReferences(schemaNames: Set<string>, spec: OpenAPISpec): void {
	const toProcess = Array.from(schemaNames);
	const processed = new Set<string>();

	while (toProcess.length > 0) {
		const schemaName = toProcess.pop();
		if (!schemaName || processed.has(schemaName)) continue;

		processed.add(schemaName);

		const schema = spec.components?.schemas?.[schemaName];
		if (schema) {
			const refs = new Set<string>();
			extractSchemaRefs(schema, refs);

			for (const ref of refs) {
				if (!schemaNames.has(ref)) {
					schemaNames.add(ref);
					toProcess.push(ref);
				}
			}
		}
	}
}

/**
 * Resolve a schema alias (allOf with single $ref)
 * @param schemaName Name of the schema to resolve
 * @param spec OpenAPI specification
 * @returns The target schema name if it's an alias, or the original name
 * @internal
 */
export function resolveSchemaAlias(schemaName: string, spec: OpenAPISpec): string {
	const schema = spec.components?.schemas?.[schemaName];
	if (!schema) return schemaName;

	// Check if schema is a simple allOf with single $ref (an alias)
	if (schema.allOf && schema.allOf.length === 1 && schema.allOf[0].$ref) {
		return resolveRefName(schema.allOf[0].$ref);
	}

	return schemaName;
}

/**
 * Detect circular references in schemas
 * @param spec OpenAPI specification
 * @returns Set of schema names involved in circular references
 */
export function detectCircularReferences(spec: OpenAPISpec): Set<string> {
	const circularSchemas = new Set<string>();
	const visited = new Set<string>();
	const recursionStack = new Set<string>();

	const detectCycle = (name: string): boolean => {
		if (recursionStack.has(name)) {
			return true;
		}

		if (visited.has(name)) {
			return false;
		}

		visited.add(name);
		recursionStack.add(name);

		const schema = spec.components?.schemas?.[name];
		if (schema) {
			const refs = new Set<string>();
			extractSchemaRefs(schema, refs);

			for (const ref of refs) {
				if (detectCycle(ref)) {
					circularSchemas.add(name);
					recursionStack.delete(name);
					return true;
				}
			}
		}

		recursionStack.delete(name);
		return false;
	};

	for (const name of Object.keys(spec.components?.schemas || {})) {
		detectCycle(name);
	}

	return circularSchemas;
}

/**
 * Check if a circular reference exists through an alias chain
 * @param fromSchema Starting schema name
 * @param toSchema Target schema name
 * @param spec OpenAPI specification
 * @returns True if there's a circular reference through aliases
 * @internal
 */
export function isCircularThroughAlias(fromSchema: string, toSchema: string, spec: OpenAPISpec): boolean {
	const visited = new Set<string>();

	const traverse = (current: string): boolean => {
		if (visited.has(current)) return false;
		if (current === toSchema) return true;

		visited.add(current);

		const resolved = resolveSchemaAlias(current, spec);
		if (resolved !== current) {
			return traverse(resolved);
		}

		return false;
	};

	return traverse(fromSchema);
}

/**
 * Build a dependency graph for all schemas in a spec
 * @param spec OpenAPI specification
 * @returns Map of schema names to their direct dependencies
 * @internal
 */
export function buildDependencyGraph(spec: OpenAPISpec): Map<string, Set<string>> {
	const graph = new Map<string, Set<string>>();

	for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
		const deps = new Set<string>();
		extractSchemaRefs(schema, deps);
		graph.set(name, deps);
	}

	return graph;
}

/**
 * Topologically sort schema names based on their dependencies
 * @param dependencies Dependency graph (schema name -> dependencies)
 * @param circularSchemas Set of schema names involved in circular references
 * @returns Ordered array of schema names
 */
export function topologicalSortSchemas(
	dependencies: Map<string, Set<string>>,
	circularSchemas: Set<string> = new Set()
): string[] {
	const sorted: string[] = [];
	const visited = new Set<string>();
	const visiting = new Set<string>();

	const visit = (name: string): void => {
		if (visited.has(name)) return;

		// Detect circular dependencies
		if (visiting.has(name)) {
			return;
		}

		visiting.add(name);

		// Visit dependencies first
		const deps = dependencies.get(name);
		if (deps && deps.size > 0) {
			for (const dep of deps) {
				if (dependencies.has(dep)) {
					visit(dep);
				}
			}
		}

		visiting.delete(name);
		visited.add(name);

		// Don't add circular dependencies yet - they need special handling
		if (!circularSchemas.has(name)) {
			sorted.push(name);
		}
	};

	// Visit all schemas
	for (const name of dependencies.keys()) {
		visit(name);
	}

	// Add circular dependencies at the end
	for (const name of circularSchemas) {
		if (!sorted.includes(name)) {
			sorted.push(name);
		}
	}

	return sorted;
}

/**
 * Check if a schema has readOnly properties
 * @param schema OpenAPI schema
 * @returns True if schema or any nested properties are readOnly
 * @internal
 */
export function hasReadOnlyProperties(schema: OpenAPISchema): boolean {
	if (schema.readOnly) return true;
	if (schema.properties) {
		for (const prop of Object.values(schema.properties)) {
			if (hasReadOnlyProperties(prop)) return true;
		}
	}
	if (schema.allOf) {
		for (const sub of schema.allOf) {
			if (hasReadOnlyProperties(sub)) return true;
		}
	}
	if (schema.items) {
		if (hasReadOnlyProperties(schema.items)) return true;
	}
	return false;
}

/**
 * Check if a schema has writeOnly properties
 * @param schema OpenAPI schema
 * @returns True if schema or any nested properties are writeOnly
 * @internal
 */
export function hasWriteOnlyProperties(schema: OpenAPISchema): boolean {
	if (schema.writeOnly) return true;
	if (schema.properties) {
		for (const prop of Object.values(schema.properties)) {
			if (hasWriteOnlyProperties(prop)) return true;
		}
	}
	if (schema.allOf) {
		for (const sub of schema.allOf) {
			if (hasWriteOnlyProperties(sub)) return true;
		}
	}
	if (schema.items) {
		if (hasWriteOnlyProperties(schema.items)) return true;
	}
	return false;
}

/**
 * Analyze schema usage across the OpenAPI spec to determine if schemas
 * are used in request, response, or both contexts
 * @param spec OpenAPI specification
 * @returns Analysis result with usage map and circular schemas
 */
export function analyzeSchemaUsage(spec: OpenAPISpec): SchemaUsageAnalysis {
	const requestSchemas = new Set<string>();
	const responseSchemas = new Set<string>();

	// Analyze paths section if available
	if (spec.paths) {
		for (const [_path, pathItem] of Object.entries(spec.paths)) {
			const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
			for (const method of methods) {
				const operation = (pathItem as Record<string, unknown>)[method];
				if (typeof operation !== "object" || !operation) continue;

				const op = operation as Record<string, unknown>;

				// Check request bodies
				if (op.requestBody && typeof op.requestBody === "object") {
					const reqBody = op.requestBody as Record<string, unknown>;
					if (reqBody.content && typeof reqBody.content === "object") {
						for (const mediaType of Object.values(reqBody.content)) {
							if (mediaType && typeof mediaType === "object") {
								const mt = mediaType as Record<string, unknown>;
								if (mt.schema) {
									extractSchemaRefs(mt.schema as OpenAPISchema, requestSchemas);
								}
							}
						}
					}
				}

				// Check responses
				if (op.responses && typeof op.responses === "object") {
					for (const response of Object.values(op.responses)) {
						if (response && typeof response === "object") {
							const resp = response as Record<string, unknown>;
							if (resp.content && typeof resp.content === "object") {
								for (const mediaType of Object.values(resp.content)) {
									if (mediaType && typeof mediaType === "object") {
										const mt = mediaType as Record<string, unknown>;
										if (mt.schema) {
											extractSchemaRefs(mt.schema as OpenAPISchema, responseSchemas);
										}
									}
								}
							}
						}
					}
				}

				// Check parameters (used in requests)
				if (op.parameters && Array.isArray(op.parameters)) {
					for (const param of op.parameters) {
						if (param && typeof param === "object") {
							const p = param as Record<string, unknown>;
							if (p.schema) {
								extractSchemaRefs(p.schema as OpenAPISchema, requestSchemas);
							}
						}
					}
				}
			}
		}

		// Expand to include all transitively referenced schemas
		expandTransitiveReferences(requestSchemas, spec);
		expandTransitiveReferences(responseSchemas, spec);
	}

	// Fallback: analyze readOnly/writeOnly properties if paths not available
	if (!spec.paths || (requestSchemas.size === 0 && responseSchemas.size === 0)) {
		for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
			const hasReadOnly = hasReadOnlyProperties(schema);
			const hasWriteOnly = hasWriteOnlyProperties(schema);

			if (hasWriteOnly && !hasReadOnly) {
				requestSchemas.add(name);
			} else if (hasReadOnly && !hasWriteOnly) {
				responseSchemas.add(name);
			}
		}
	}

	// Build usage map
	const usageMap = new Map<string, SchemaContext>();
	for (const [name] of Object.entries(spec.components?.schemas || {})) {
		if (requestSchemas.has(name) && responseSchemas.has(name)) {
			usageMap.set(name, "both");
		} else if (requestSchemas.has(name)) {
			usageMap.set(name, "request");
		} else if (responseSchemas.has(name)) {
			usageMap.set(name, "response");
		}
	}

	// Detect circular references
	const circularSchemas = detectCircularReferences(spec);

	// Mark circular schemas as "both" for safety
	for (const name of circularSchemas) {
		usageMap.set(name, "both");
	}

	return {
		usageMap,
		circularSchemas,
		requestSchemas,
		responseSchemas,
	};
}

/**
 * Resolve discriminator mapping to ordered schema names
 * @param discriminator OpenAPI discriminator object
 * @param spec OpenAPI specification
 * @returns Array of [discriminatorValue, schemaName] pairs in definition order
 * @internal
 */
export function resolveDiscriminatorMapping(
	discriminator: { propertyName: string; mapping?: Record<string, string> },
	spec: OpenAPISpec
): Array<[string, string]> {
	const result: Array<[string, string]> = [];

	if (!discriminator.mapping) {
		return result;
	}

	for (const [value, ref] of Object.entries(discriminator.mapping)) {
		const schemaName = resolveRefName(ref);
		// Verify schema exists
		if (spec.components?.schemas?.[schemaName]) {
			result.push([value, schemaName]);
		}
	}

	return result;
}

/**
 * Validate that discriminator property is required in all variant schemas
 * @param schemaNames Array of schema names to check
 * @param propertyName Discriminator property name
 * @param spec OpenAPI specification
 * @returns True if property is required in all schemas
 * @internal
 */
export function validateDiscriminatorProperty(schemaNames: string[], propertyName: string, spec: OpenAPISpec): boolean {
	for (const name of schemaNames) {
		const schema = spec.components?.schemas?.[name];
		if (!schema) continue;

		// Check if property exists and is required
		const hasProperty = schema.properties?.[propertyName] !== undefined;
		const isRequired = Array.isArray(schema.required) && schema.required.includes(propertyName);

		if (!hasProperty || !isRequired) {
			return false;
		}
	}

	return true;
}

/**
 * Classify enum values by their type
 * @param values Array of enum values
 * @returns The classification of enum type
 */
export function classifyEnumType(values: unknown[]): "boolean" | "string" | "number" | "mixed" {
	if (values.length === 0) return "mixed";

	const allBooleans = values.every(v => typeof v === "boolean");
	if (allBooleans) return "boolean";

	const allStrings = values.every(v => typeof v === "string");
	if (allStrings) return "string";

	const allNumbers = values.every(v => typeof v === "number");
	if (allNumbers) return "number";

	return "mixed";
}

/**
 * Get all schema names from a spec in a consistent order
 * @param spec OpenAPI specification
 * @returns Array of schema names
 * @internal
 */
export function getSchemaNames(spec: OpenAPISpec): string[] {
	return Object.keys(spec.components?.schemas || {});
}

/**
 * Get a schema by name from the spec
 * @param spec OpenAPI specification
 * @param name Schema name
 * @returns The schema or undefined
 * @internal
 */
export function getSchema(spec: OpenAPISpec, name: string): OpenAPISchema | undefined {
	return spec.components?.schemas?.[name];
}
