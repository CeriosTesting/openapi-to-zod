import type { OpenAPISchema } from "../types";
import { addDescription } from "../utils/string-utils";

/**
 * Generate Zod validation for number
 */
export function generateNumberValidation(schema: OpenAPISchema, isInt: boolean, useDescribe: boolean): string {
	let validation = isInt ? "z.number().int()" : "z.number()";

	// Handle minimum with exclusive bounds
	if (schema.minimum !== undefined) {
		const isExclusive = schema.exclusiveMinimum === true;
		validation += isExclusive ? `.gt(${schema.minimum})` : `.gte(${schema.minimum})`;
	} else if (typeof schema.exclusiveMinimum === "number") {
		// OpenAPI 3.1 style: exclusiveMinimum as number
		validation += `.gt(${schema.exclusiveMinimum})`;
	}

	// Handle maximum with exclusive bounds
	if (schema.maximum !== undefined) {
		const isExclusive = schema.exclusiveMaximum === true;
		validation += isExclusive ? `.lt(${schema.maximum})` : `.lte(${schema.maximum})`;
	} else if (typeof schema.exclusiveMaximum === "number") {
		// OpenAPI 3.1 style: exclusiveMaximum as number
		validation += `.lt(${schema.exclusiveMaximum})`;
	}

	if (schema.multipleOf !== undefined) {
		validation += `.multipleOf(${schema.multipleOf})`;
	}

	// Add description if useDescribe is enabled
	return addDescription(validation, schema.description, useDescribe);
}
