import type { OpenAPISchema } from "../types";
import { addDescription } from "../utils/string-utils";

export interface ArrayValidatorContext {
	generatePropertySchema: (schema: OpenAPISchema, currentSchema?: string) => string;
	useDescribe: boolean;
	currentSchema?: string;
}

/**
 * Generate array or tuple validation
 */
export function generateArrayValidation(schema: OpenAPISchema, context: ArrayValidatorContext): string {
	let validation: string;

	// Handle prefixItems (tuple validation - OpenAPI 3.1)
	if (schema.prefixItems && schema.prefixItems.length > 0) {
		const tupleItems = schema.prefixItems.map(item => context.generatePropertySchema(item, context.currentSchema));
		validation = `z.tuple([${tupleItems.join(", ")}])`;

		// Add rest items if specified (items after the fixed prefix)
		// items takes precedence over unevaluatedItems
		if (schema.items) {
			const restSchema = context.generatePropertySchema(schema.items, context.currentSchema);
			validation += `.rest(${restSchema})`;
		} else if (schema.unevaluatedItems && typeof schema.unevaluatedItems === "object") {
			// Use unevaluatedItems as rest schema if items not specified
			const restSchema = context.generatePropertySchema(schema.unevaluatedItems, context.currentSchema);
			validation += `.rest(${restSchema})`;
		}
		// If unevaluatedItems is false (or undefined), tuple has fixed length by default
	} else if (schema.items) {
		const itemSchema = context.generatePropertySchema(schema.items, context.currentSchema);
		validation = `z.array(${itemSchema})`;

		// Add array constraints
		if (schema.minItems !== undefined) {
			validation += `.min(${schema.minItems})`;
		}
		if (schema.maxItems !== undefined) {
			validation += `.max(${schema.maxItems})`;
		}

		// Add uniqueItems constraint
		if (schema.uniqueItems === true) {
			validation += `.refine((items) => new Set(items).size === items.length, { message: "Array items must be unique" })`;
		}
	} else {
		validation = "z.array(z.unknown())";
	}

	// Handle contains with min/max constraints
	if (schema.contains) {
		const containsSchema = context.generatePropertySchema(schema.contains, context.currentSchema);
		const minCount = schema.minContains ?? 1;
		const maxCount = schema.maxContains;

		if (maxCount !== undefined) {
			// Both min and max
			validation += `.refine((arr) => { const matches = arr.filter(item => ${containsSchema}.safeParse(item).success); return matches.length >= ${minCount} && matches.length <= ${maxCount}; }, { message: "Array must contain between ${minCount} and ${maxCount} items matching the schema" })`;
		} else {
			// Just min
			validation += `.refine((arr) => arr.filter(item => ${containsSchema}.safeParse(item).success).length >= ${minCount}, { message: "Array must contain at least ${minCount} item(s) matching the schema" })`;
		}
	}

	// Handle unevaluatedItems (OpenAPI 3.1) - only applies to prefixItems scenarios
	// Note: unevaluatedItems with prefixItems should use .rest() which was already handled above
	// This section handles the false case which needs to restrict the length
	if (schema.unevaluatedItems === false && schema.prefixItems && schema.prefixItems.length > 0 && !schema.items) {
		// No items beyond prefixItems allowed - add length restriction
		const prefixCount = schema.prefixItems.length;
		validation += `.refine((arr) => arr.length <= ${prefixCount}, { message: "No unevaluated items allowed beyond prefix items" })`;
	}

	// Add description if useDescribe is enabled
	return addDescription(validation, schema.description, context.useDescribe);
}
