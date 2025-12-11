import type { OpenAPISchema } from "../types";
import { wrapNullable } from "../utils/string-utils";

export interface CompositionValidatorContext {
	generatePropertySchema: (schema: OpenAPISchema, currentSchema?: string, isTopLevel?: boolean) => string;
	resolveDiscriminatorMapping?: (mapping: Record<string, string>, schemas: OpenAPISchema[]) => OpenAPISchema[];
}

export interface UnionOptions {
	passthrough?: boolean;
	discriminatorMapping?: Record<string, string>;
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
	if (discriminator) {
		// Apply discriminator mapping if provided
		let resolvedSchemas = schemas;
		if (options?.discriminatorMapping && context.resolveDiscriminatorMapping) {
			resolvedSchemas = context.resolveDiscriminatorMapping(options.discriminatorMapping, schemas);
		}

		// Use discriminated union for better type inference
		let schemaStrings = resolvedSchemas.map(s => context.generatePropertySchema(s, currentSchema));
		if (options?.passthrough) {
			schemaStrings = schemaStrings.map(s => (s.includes(".catchall(") ? s : `${s}.catchall(z.unknown())`));
		}
		const union = `z.discriminatedUnion("${discriminator}", [${schemaStrings.join(", ")}])`;
		return wrapNullable(union, isNullable);
	}

	let schemaStrings = schemas.map(s => context.generatePropertySchema(s, currentSchema));
	if (options?.passthrough) {
		schemaStrings = schemaStrings.map(s => (s.includes(".catchall(") ? s : `${s}.catchall(z.unknown())`));
	}
	const union = `z.union([${schemaStrings.join(", ")}])`;
	return wrapNullable(union, isNullable);
}

/**
 * Generate allOf validation
 */
export function generateAllOf(
	schemas: OpenAPISchema[],
	isNullable: boolean,
	context: CompositionValidatorContext,
	currentSchema?: string
): string {
	if (schemas.length === 1) {
		const singleSchema = context.generatePropertySchema(schemas[0], currentSchema, false);
		return wrapNullable(singleSchema, isNullable);
	}

	// Check if all schemas are objects (for .merge() support)
	const allObjects = schemas.every(s => s.type === "object" || s.properties || s.$ref || s.allOf);

	const schemaStrings = schemas.map(s => context.generatePropertySchema(s, currentSchema, false));

	if (allObjects) {
		// Use .merge() for object schemas (better type inference)
		let merged = schemaStrings[0];
		for (let i = 1; i < schemaStrings.length; i++) {
			merged = `${merged}.merge(${schemaStrings[i]})`;
		}
		return wrapNullable(merged, isNullable);
	}

	// Use .and() for non-object schemas (intersection)
	let merged = schemaStrings[0];
	for (let i = 1; i < schemaStrings.length; i++) {
		merged = `${merged}.and(${schemaStrings[i]})`;
	}
	return wrapNullable(merged, isNullable);
}
