import type { OpenAPISchema } from "../types";

/**
 * Generate validation for dependencies (OpenAPI 3.0)
 */
export function generateDependencies(
	schema: OpenAPISchema,
	generatePropertySchema?: (schema: OpenAPISchema, currentSchema?: string) => string,
	currentSchema?: string
): string {
	if (!schema.dependencies) {
		return "";
	}

	let result = "";
	for (const [prop, dependency] of Object.entries(schema.dependencies)) {
		if (Array.isArray(dependency)) {
			// Property dependency - if prop exists, these properties must also exist
			const requiredProps = dependency.map(p => `obj["${p}"] !== undefined`).join(" && ");
			const propList = dependency.map(p => `'${p}'`).join(", ");
			result += `.refine((obj) => obj["${prop}"] === undefined || (${requiredProps}), { message: "When '${prop}' is present, ${propList} must also be present" })`;
		} else if (generatePropertySchema) {
			// Schema dependency - if prop exists, entire object must match the dependency schema
			// In OpenAPI 3.0, dependency schemas are implicitly objects, so ensure type is set
			const depSchema: OpenAPISchema = { ...dependency, type: dependency.type || "object" };
			const depSchemaValidation = generatePropertySchema(depSchema, currentSchema);
			result += `.refine((obj) => obj["${prop}"] === undefined || ${depSchemaValidation}.safeParse(obj).success, { message: "When '${prop}' is present, object must satisfy additional schema constraints" })`;
		}
		// Note: If generatePropertySchema is not provided, schema dependencies are silently skipped
	}
	return result;
}

/**
 * Generate condition check for if/then/else
 */
export function generateConditionalCheck(schema: OpenAPISchema): string {
	const conditions: string[] = [];

	// Check properties
	if (schema.properties) {
		for (const [prop, propSchema] of Object.entries(schema.properties)) {
			if (propSchema.type) {
				conditions.push(`typeof obj["${prop}"] === "${propSchema.type}"`);
			}
			if (propSchema.const !== undefined) {
				const value = typeof propSchema.const === "string" ? `"${propSchema.const}"` : propSchema.const;
				conditions.push(`obj["${prop}"] === ${value}`);
			}
			if (propSchema.minimum !== undefined) {
				conditions.push(`obj["${prop}"] >= ${propSchema.minimum}`);
			}
			if (propSchema.maximum !== undefined) {
				conditions.push(`obj["${prop}"] <= ${propSchema.maximum}`);
			}
		}
	}

	// Check required properties
	if (schema.required) {
		for (const prop of schema.required) {
			conditions.push(`obj["${prop}"] !== undefined`);
		}
	}

	return conditions.length > 0 ? conditions.join(" && ") : "true";
}

/**
 * Generate validation for then/else clauses
 */
export function generateConditionalValidation(schema: OpenAPISchema): string {
	const checks: string[] = [];

	// Check required properties
	if (schema.required) {
		for (const prop of schema.required) {
			checks.push(`obj["${prop}"] !== undefined`);
		}
	}

	// Check properties constraints
	if (schema.properties) {
		for (const [prop, propSchema] of Object.entries(schema.properties)) {
			if (propSchema.minimum !== undefined) {
				checks.push(`obj["${prop}"] === undefined || obj["${prop}"] >= ${propSchema.minimum}`);
			}
			if (propSchema.maximum !== undefined) {
				checks.push(`obj["${prop}"] === undefined || obj["${prop}"] <= ${propSchema.maximum}`);
			}
		}
	}

	return checks.length > 0 ? checks.join(" && ") : "true";
}

/**
 * Generate if/then/else conditional validation
 */
export function generateIfThenElse(schema: OpenAPISchema): string {
	if (!schema.if || (!schema.then && !schema.else)) {
		return "";
	}

	const ifCondition = generateConditionalCheck(schema.if);

	if (schema.then && schema.else) {
		// Both then and else
		const thenValidation = generateConditionalValidation(schema.then);
		const elseValidation = generateConditionalValidation(schema.else);
		return `.refine((obj) => {
			if (${ifCondition}) {
				return ${thenValidation};
			} else {
				return ${elseValidation};
			}
		}, { message: "Conditional validation failed" })`;
	}

	if (schema.then) {
		// Only then
		const thenValidation = generateConditionalValidation(schema.then);
		return `.refine((obj) => {
			if (${ifCondition}) {
				return ${thenValidation};
			}
			return true;
		}, { message: "Conditional validation failed" })`;
	}

	// Only else
	if (!schema.else) return "";
	const elseValidation = generateConditionalValidation(schema.else);
	return `.refine((obj) => {
		if (!(${ifCondition})) {
			return ${elseValidation};
		}
		return true;
	}, { message: "Conditional validation failed" })`;
}

/**
 * Generate dependent required validation
 */
export function generateDependentRequired(schema: OpenAPISchema): string {
	if (!schema.dependentRequired) {
		return "";
	}

	let result = "";
	for (const [prop, requiredProps] of Object.entries(schema.dependentRequired)) {
		const requiredChecks = requiredProps.map(rp => `obj["${rp}"] !== undefined`).join(" && ");
		const dependentCondition = `obj["${prop}"] === undefined || (${requiredChecks})`;
		const depMessage = `When '${prop}' is present, ${requiredProps.join(", ")} must also be present`;
		result += `.refine((obj) => ${dependentCondition}, { message: "${depMessage}" })`;
	}

	return result;
}
