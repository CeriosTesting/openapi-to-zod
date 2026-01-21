import type { OpenAPISchema } from "../types";
import { wrapNullable } from "../utils/string-utils";

export interface CompositionValidatorContext {
	generatePropertySchema: (
		schema: OpenAPISchema,
		currentSchema?: string,
		isTopLevel?: boolean,
		suppressDefaultNullable?: boolean
	) => string;
	/**
	 * Generate inline object shape for use with .extend()
	 * Returns just the shape object literal: { prop1: z.string(), prop2: z.number() }
	 * This avoids the .nullable().shape bug when inline objects have nullable: true
	 */
	generateInlineObjectShape?: (schema: OpenAPISchema, currentSchema?: string) => string;
	resolveDiscriminatorMapping?: (mapping: Record<string, string>, schemas: OpenAPISchema[]) => OpenAPISchema[];
	resolveSchemaRef?: (ref: string) => OpenAPISchema | undefined;
}

export interface UnionOptions {
	passthrough?: boolean;
	discriminatorMapping?: Record<string, string>;
}

/**
 * Check if discriminator property is required in all schemas
 */
function isDiscriminatorRequired(
	schemas: OpenAPISchema[],
	discriminator: string,
	context: CompositionValidatorContext
): { valid: boolean; invalidSchemas: string[] } {
	const invalidSchemas: string[] = [];

	for (const schema of schemas) {
		const resolved = resolveSchema(schema, context);
		const required = resolved.required || [];

		if (!required.includes(discriminator)) {
			const schemaName = schema.$ref ? schema.$ref.split("/").pop() || "inline" : "inline";
			invalidSchemas.push(schemaName);
		}
	}

	return {
		valid: invalidSchemas.length === 0,
		invalidSchemas,
	};
}

/**
 * Generate union validation
 */
export function generateUnion(
	schemas: OpenAPISchema[],
	discriminator: string | undefined,
	isNullable: boolean,
	context: CompositionValidatorContext,
	options?: UnionOptions,
	currentSchema?: string
): string {
	// Handle empty oneOf/anyOf - malformed spec, warn and return z.never()
	if (schemas.length === 0) {
		console.warn(
			"[openapi-to-zod] Warning: Empty oneOf/anyOf array encountered. This is likely a malformed OpenAPI spec. Generating z.never() as fallback."
		);
		return wrapNullable(
			'z.never().describe("Empty oneOf/anyOf in OpenAPI spec - no valid schema defined")',
			isNullable
		);
	}

	// Simplify single-item oneOf/anyOf - no union needed
	if (schemas.length === 1) {
		// Suppress defaultNullable - this is a schema definition, not a property value
		let singleSchema = context.generatePropertySchema(schemas[0], currentSchema, false, true);
		if (options?.passthrough && !singleSchema.includes(".catchall(")) {
			singleSchema = `${singleSchema}.catchall(z.unknown())`;
		}
		return wrapNullable(singleSchema, isNullable);
	}

	if (discriminator) {
		// Apply discriminator mapping if provided
		let resolvedSchemas = schemas;
		if (options?.discriminatorMapping && context.resolveDiscriminatorMapping) {
			resolvedSchemas = context.resolveDiscriminatorMapping(options.discriminatorMapping, schemas);
		}

		// Check if discriminator is required in all schemas
		const discriminatorCheck = isDiscriminatorRequired(resolvedSchemas, discriminator, context);

		if (!discriminatorCheck.valid) {
			// Discriminator is not required in all schemas - fallback to z.union()
			console.warn(
				`[openapi-to-zod] Warning: Discriminator "${discriminator}" is not required in schemas: ${discriminatorCheck.invalidSchemas.join(", ")}. ` +
					"Falling back to z.union() instead of z.discriminatedUnion()."
			);

			// Suppress defaultNullable on each variant - they are schema definitions, not property values
			let schemaStrings = resolvedSchemas.map(s => context.generatePropertySchema(s, currentSchema, false, true));
			if (options?.passthrough) {
				schemaStrings = schemaStrings.map(s => (s.includes(".catchall(") ? s : `${s}.catchall(z.unknown())`));
			}

			const fallbackDescription = `Discriminator "${discriminator}" is optional in some schemas (${discriminatorCheck.invalidSchemas.join(", ")}), using z.union() instead of z.discriminatedUnion()`;
			const union = `z.union([${schemaStrings.join(", ")}]).describe("${fallbackDescription}")`;
			return wrapNullable(union, isNullable);
		}

		// Use discriminated union for better type inference
		// Suppress defaultNullable on each variant - they are schema definitions, not property values
		let schemaStrings = resolvedSchemas.map(s => context.generatePropertySchema(s, currentSchema, false, true));
		if (options?.passthrough) {
			schemaStrings = schemaStrings.map(s => (s.includes(".catchall(") ? s : `${s}.catchall(z.unknown())`));
		}
		const union = `z.discriminatedUnion("${discriminator}", [${schemaStrings.join(", ")}])`;
		return wrapNullable(union, isNullable);
	}

	// Suppress defaultNullable on each variant - they are schema definitions, not property values
	let schemaStrings = schemas.map(s => context.generatePropertySchema(s, currentSchema, false, true));
	if (options?.passthrough) {
		schemaStrings = schemaStrings.map(s => (s.includes(".catchall(") ? s : `${s}.catchall(z.unknown())`));
	}
	const union = `z.union([${schemaStrings.join(", ")}])`;
	return wrapNullable(union, isNullable);
}

/**
 * Helper to resolve schema (follows $ref if needed)
 */
function resolveSchema(schema: OpenAPISchema, context: CompositionValidatorContext): OpenAPISchema {
	if (schema.$ref && context.resolveSchemaRef) {
		const resolved = context.resolveSchemaRef(schema.$ref);
		if (resolved) {
			return resolved;
		}
	}
	return schema;
}

/**
 * Collect properties from a schema (including nested allOf)
 */
function collectProperties(
	schema: OpenAPISchema,
	context: CompositionValidatorContext
): Map<string, { schema: OpenAPISchema; source: string }> {
	const resolved = resolveSchema(schema, context);
	const props = new Map<string, { schema: OpenAPISchema; source: string }>();

	// Get source name for error messages
	const sourceName = schema.$ref ? schema.$ref.split("/").pop() || "unknown" : "inline";

	// Collect direct properties
	if (resolved.properties) {
		for (const [key, value] of Object.entries(resolved.properties)) {
			props.set(key, { schema: value, source: sourceName });
		}
	}

	// Recursively collect from nested allOf
	if (resolved.allOf) {
		for (const subSchema of resolved.allOf) {
			const subProps = collectProperties(subSchema, context);
			for (const [key, value] of subProps) {
				if (!props.has(key)) {
					props.set(key, value);
				}
			}
		}
	}

	return props;
}

/**
 * Check if two schemas are semantically equivalent
 */
function schemasMatch(a: OpenAPISchema, b: OpenAPISchema): boolean {
	// Simple deep comparison for common cases
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Detect conflicting properties across allOf schemas
 */
function detectConflictingProperties(schemas: OpenAPISchema[], context: CompositionValidatorContext): string[] {
	const conflicts: string[] = [];
	const propertyMap = new Map<string, { schema: OpenAPISchema; source: string }>();

	for (const schema of schemas) {
		const schemaProps = collectProperties(schema, context);

		for (const [propName, propInfo] of schemaProps) {
			const existing = propertyMap.get(propName);
			if (existing) {
				// Check if the definitions match
				if (!schemasMatch(existing.schema, propInfo.schema)) {
					conflicts.push(
						`Property "${propName}" has conflicting definitions in ${existing.source} and ${propInfo.source}`
					);
				}
			} else {
				propertyMap.set(propName, propInfo);
			}
		}
	}

	return conflicts;
}

/**
 * Generate allOf validation
 *
 * Key fix: For inline objects in allOf, we generate the shape directly as an object literal
 * (e.g., { prop: z.string() }) instead of using z.object({...}).shape.
 * This avoids the invalid .nullable().shape pattern that occurs when inline objects
 * have nullable: true set.
 *
 * According to Zod docs (https://zod.dev/api?id=extend):
 * - .extend() accepts an object of shape definitions OR another schema's .shape
 * - For $refs: use baseSchema.extend(otherSchema.shape)
 * - For inline objects: use baseSchema.extend({ prop: z.string() })
 * - .nullable() must be applied AFTER all .extend() calls
 * - defaultNullable should NOT apply to schemas in allOf - they are schema shapes, not property values
 */
export function generateAllOf(
	schemas: OpenAPISchema[],
	isNullable: boolean,
	context: CompositionValidatorContext,
	currentSchema?: string
): string {
	if (schemas.length === 1) {
		// Single-item allOf is essentially an alias - suppress defaultNullable
		// because this is a schema definition, not a property value
		const singleSchema = context.generatePropertySchema(schemas[0], currentSchema, false, true);
		return wrapNullable(singleSchema, isNullable);
	}

	// Detect conflicting properties and warn
	const conflicts = detectConflictingProperties(schemas, context);
	let conflictDescription = "";
	if (conflicts.length > 0) {
		for (const conflict of conflicts) {
			console.warn(`[openapi-to-zod] Warning: allOf composition conflict - ${conflict}`);
		}
		conflictDescription = `allOf property conflicts detected: ${conflicts.join("; ")}`;
	}

	// Check if all schemas are objects (for .extend() support)
	const allObjects = schemas.every(s => s.type === "object" || s.properties || s.$ref || s.allOf);

	let result: string;
	if (allObjects) {
		// Use .extend() for object schemas (Zod v4 compliant - .merge() is deprecated)
		// First schema is the base - generate with suppressDefaultNullable=true
		// because this is a schema shape, not a property value
		let merged = context.generatePropertySchema(schemas[0], currentSchema, false, true);

		// For subsequent schemas, determine how to extend
		for (let i = 1; i < schemas.length; i++) {
			const schema = schemas[i];

			if (schema.$ref) {
				// For $ref schemas, use .extend(refSchema.shape)
				// Suppress defaultNullable - this is a schema shape, not a property value
				const refSchema = context.generatePropertySchema(schema, currentSchema, false, true);
				merged = `${merged}.extend(${refSchema}.shape)`;
			} else if (context.generateInlineObjectShape && (schema.properties || schema.type === "object")) {
				// For inline objects, generate shape directly as object literal
				// This avoids the .nullable().shape bug - we pass { prop: z.string() }
				// directly to .extend() instead of z.object({...}).nullable().shape
				// Note: generateInlineObjectShape respects defaultNullable for properties INSIDE the object
				const inlineShape = context.generateInlineObjectShape(schema, currentSchema);
				merged = `${merged}.extend(${inlineShape})`;
			} else {
				// Fallback for schemas without properties (e.g., just has allOf)
				// Generate full schema with suppressDefaultNullable and use .shape
				const schemaString = context.generatePropertySchema(schema, currentSchema, false, true);
				merged = `${merged}.extend(${schemaString}.shape)`;
			}
		}
		result = merged;
	} else {
		// Use .and() for non-object schemas (intersection)
		// Suppress defaultNullable on each schema in the intersection
		const schemaStrings = schemas.map(s => context.generatePropertySchema(s, currentSchema, false, true));
		let merged = schemaStrings[0];
		for (let i = 1; i < schemaStrings.length; i++) {
			merged = `${merged}.and(${schemaStrings[i]})`;
		}
		result = merged;
	}

	// Add description about conflicts if any
	if (conflictDescription) {
		result = `${result}.describe("${conflictDescription}")`;
	}

	// Apply nullable at the END, after all .extend() calls
	// This is critical - .nullable() must come after .extend(), not before
	return wrapNullable(result, isNullable);
}
