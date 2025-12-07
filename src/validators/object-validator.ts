import { generateJSDoc } from "../generators/jsdoc-generator";
import type { OpenAPISchema } from "../types";
import { generateDependencies, generateDependentRequired, generateIfThenElse } from "./conditional-validator";

export type ObjectMode = "strict" | "normal" | "loose";

export interface ObjectValidatorContext {
	generatePropertySchema: (schema: OpenAPISchema, currentSchema?: string) => string;
	shouldIncludeProperty: (schema: OpenAPISchema) => boolean;
	mode: ObjectMode;
	includeDescriptions: boolean;
	useDescribe: boolean;
}

/**
 * Generate object schema
 */
export function generateObjectSchema(
	schema: OpenAPISchema,
	context: ObjectValidatorContext,
	currentSchema?: string
): string {
	const required = new Set(schema.required || []);
	const properties: string[] = [];

	// Process properties if they exist
	if (schema.properties) {
		for (const [propName, propSchema] of Object.entries(schema.properties)) {
			// Skip properties based on readOnly/writeOnly and schemaType
			if (!context.shouldIncludeProperty(propSchema)) {
				continue;
			}

			const isRequired = required.has(propName);
			const zodSchema = context.generatePropertySchema(propSchema, currentSchema);

			let propertyDef = `  ${propName}: ${zodSchema}`;
			if (!isRequired) {
				propertyDef += ".optional()";
			}

			// Add JSDoc for property if enabled
			const jsdoc = generateJSDoc(propSchema, propName, { includeDescriptions: context.includeDescriptions });
			if (jsdoc) {
				properties.push(`${jsdoc.trimEnd()}\n${propertyDef}`);
			} else {
				properties.push(propertyDef);
			}
		}
	}

	// Determine object method based on mode and additionalProperties
	let objectMethod: string;

	// additionalProperties: false always uses strictObject
	if (schema.additionalProperties === false) {
		objectMethod = "z.strictObject";
	} else {
		// Otherwise respect the mode setting
		switch (context.mode) {
			case "strict":
				objectMethod = "z.strictObject";
				break;
			case "loose":
				objectMethod = "z.looseObject";
				break;
			default:
				objectMethod = "z.object";
		}
	}

	let objectDef = `${objectMethod}({\n${properties.join(",\n")}\n})`;

	// Handle additionalProperties for typed catchall
	if (schema.additionalProperties !== undefined) {
		if (typeof schema.additionalProperties === "object") {
			// Additional properties with specific schema
			const additionalSchema = context.generatePropertySchema(schema.additionalProperties, currentSchema);
			objectDef += `.catchall(${additionalSchema})`;
		} else if (schema.additionalProperties === true) {
			// Any additional properties allowed
			objectDef += ".catchall(z.unknown())";
		}
		// Note: additionalProperties: false is handled by using z.strictObject
	} else if (schema.patternProperties) {
		// If pattern properties are defined but additionalProperties is not, allow properties through
		// so they can be validated by pattern property refinements
		objectDef += ".passthrough()";
	}

	// Handle minProperties and maxProperties
	if (schema.minProperties !== undefined || schema.maxProperties !== undefined) {
		const conditions: string[] = [];
		if (schema.minProperties !== undefined) {
			conditions.push(`Object.keys(obj).length >= ${schema.minProperties}`);
		}
		if (schema.maxProperties !== undefined) {
			conditions.push(`Object.keys(obj).length <= ${schema.maxProperties}`);
		}
		const condition = conditions.join(" && ");
		let message = "Object ";
		if (schema.minProperties !== undefined && schema.maxProperties !== undefined) {
			message += `must have between ${schema.minProperties} and ${schema.maxProperties} properties`;
		} else if (schema.minProperties !== undefined) {
			message += `must have at least ${schema.minProperties} ${schema.minProperties === 1 ? "property" : "properties"}`;
		} else {
			message += `must have at most ${schema.maxProperties} ${schema.maxProperties === 1 ? "property" : "properties"}`;
		}
		objectDef += `.refine((obj) => ${condition}, { message: "${message}" })`;
	}

	// Handle required fields that aren't in properties (common in schema dependencies)
	const definedProps = new Set(Object.keys(schema.properties || {}));
	const undefinedRequired = (schema.required || []).filter(prop => !definedProps.has(prop));
	if (undefinedRequired.length > 0) {
		// Need passthrough to allow required fields that aren't in properties
		if (!objectDef.includes(".passthrough()") && !objectDef.includes(".catchall(")) {
			objectDef += ".passthrough()";
		}
		const requiredChecks = undefinedRequired.map(prop => `obj["${prop}"] !== undefined`).join(" && ");
		const propList = undefinedRequired.join(", ");
		objectDef += `.refine((obj) => ${requiredChecks}, { message: "Missing required fields: ${propList}" })`;
	}

	// Handle pattern properties
	if (schema.patternProperties) {
		const definedProps = Object.keys(schema.properties || {});
		const definedPropsSet = `new Set(${JSON.stringify(definedProps)})`;
		for (const [pattern, patternSchema] of Object.entries(schema.patternProperties)) {
			const patternZodSchema = context.generatePropertySchema(patternSchema, currentSchema);
			const escapedPattern = pattern.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
			objectDef += `.refine((obj) => Object.keys(obj).filter(key => !${definedPropsSet}.has(key)).every(key => !/${escapedPattern}/.test(key) || ${patternZodSchema}.safeParse(obj[key]).success), { message: "Properties matching pattern '${pattern}' must satisfy the schema" })`;
		}
	}

	// Handle property names validation
	if (schema.propertyNames) {
		if (schema.propertyNames.pattern) {
			const escapedPattern = schema.propertyNames.pattern.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
			objectDef += `.refine((obj) => Object.keys(obj).every(key => /${escapedPattern}/.test(key)), { message: "Property names must match pattern '${schema.propertyNames.pattern}'" })`;
		}
		if (schema.propertyNames.minLength !== undefined) {
			objectDef += `.refine((obj) => Object.keys(obj).every(key => key.length >= ${schema.propertyNames.minLength}), { message: "Property names must be at least ${schema.propertyNames.minLength} characters" })`;
		}
		if (schema.propertyNames.maxLength !== undefined) {
			objectDef += `.refine((obj) => Object.keys(obj).every(key => key.length <= ${schema.propertyNames.maxLength}), { message: "Property names must be at most ${schema.propertyNames.maxLength} characters" })`;
		}
	}

	// Handle dependencies (OpenAPI 3.0)
	objectDef += generateDependencies(schema, context.generatePropertySchema, currentSchema);

	// Handle dependentRequired
	objectDef += generateDependentRequired(schema);

	// Handle if/then/else conditionals
	objectDef += generateIfThenElse(schema);

	return objectDef;
}
