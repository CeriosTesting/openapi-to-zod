import { generateJSDoc } from "../generators/jsdoc-generator";
import type { OpenAPISchema } from "../types";

import { generateDependencies, generateDependentRequired, generateIfThenElse } from "./conditional-validator";

/**
 * Check if a property name needs to be quoted in TypeScript object literal
 */
function needsQuoting(propName: string): boolean {
	// Valid identifier: starts with letter/underscore/$, followed by letters/digits/underscores/$
	const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
	return !validIdentifier.test(propName);
}

/**
 * Generate property access expression (use dot notation for valid identifiers, bracket notation otherwise)
 */
function generatePropertyAccess(propName: string): string {
	return needsQuoting(propName) ? `obj["${propName}"]` : `obj.${propName}`;
}

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

			// Quote property name if it contains special characters
			const quotedPropName = needsQuoting(propName) ? `"${propName}"` : propName;
			let propertyDef = `  ${quotedPropName}: ${zodSchema}`;
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
		objectDef += ".catchall(z.unknown())";
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
		// Need catchall to allow required fields that aren't in properties
		if (!objectDef.includes(".catchall(")) {
			objectDef += ".catchall(z.unknown())";
		}
		const requiredChecks = undefinedRequired.map(prop => `${generatePropertyAccess(prop)} !== undefined`).join(" && ");
		const propList = undefinedRequired.join(", ");
		objectDef += `.refine((obj) => ${requiredChecks}, { message: "Missing required fields: ${propList}" })`;
	}

	// Handle pattern properties with first-match-wins priority
	if (schema.patternProperties) {
		const definedProps = Object.keys(schema.properties || {});
		const definedPropsSet = `new Set(${JSON.stringify(definedProps)})`;
		const patterns = Object.entries(schema.patternProperties);

		// Generate schemas for all patterns
		const patternSchemas = patterns.map(([pattern, patternSchema]) => ({
			pattern,
			escapedPattern: pattern.replace(/\\/g, "\\\\").replace(/'/g, "\\'"),
			zodSchema: context.generatePropertySchema(patternSchema, currentSchema),
		}));

		// Single superRefine for all patterns (more efficient)
		objectDef += `.superRefine((obj, ctx) => {
			const definedPropsSet = ${definedPropsSet};
			const patterns = ${JSON.stringify(patternSchemas.map(p => ({ pattern: p.escapedPattern })))};
			const schemas = [${patternSchemas.map(p => p.zodSchema).join(", ")}];
			const regexps = patterns.map(p => new RegExp(p.pattern));

			// Check all object keys
			for (const key of Object.keys(obj)) {
				// Skip properties that are explicitly defined
				if (definedPropsSet.has(key)) continue;

				// Find first matching pattern (first-match-wins priority)
				for (let i = 0; i < regexps.length; i++) {
					if (regexps[i].test(key)) {
						const validation = schemas[i].safeParse(obj[key]);
						if (!validation.success) {
							// Add detailed error messages with property name and pattern
							for (const issue of validation.error.issues) {
								ctx.addIssue({
									...issue,
									path: [key, ...issue.path],
									message: \`Property '\${key}' (pattern '\${patterns[i].pattern}'): \${issue.message}\`
								});
							}
						}
						break; // First match wins, stop checking other patterns
					}
				}
			}
		})`;
	}

	// Handle property names validation (consolidated for efficiency)
	if (schema.propertyNames) {
		const hasPattern = schema.propertyNames.pattern !== undefined;
		const hasMinLength = schema.propertyNames.minLength !== undefined;
		const hasMaxLength = schema.propertyNames.maxLength !== undefined;

		if (hasPattern || hasMinLength || hasMaxLength) {
			const escapedPattern =
				hasPattern && schema.propertyNames.pattern
					? schema.propertyNames.pattern.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
					: null;
			const minLen = schema.propertyNames.minLength;
			const maxLen = schema.propertyNames.maxLength;

			objectDef += `.superRefine((obj, ctx) => {
				${escapedPattern ? `const pattern = /${escapedPattern}/;` : ""}

				for (const key of Object.keys(obj)) {
					const failures: string[] = [];

					${
						hasPattern
							? `
					if (!pattern.test(key)) {
						failures.push("must match pattern '${schema.propertyNames.pattern}'");
					}
					`
							: ""
					}

					${
						hasMinLength
							? `
					if (key.length < ${minLen}) {
						failures.push("must be at least ${minLen} characters");
					}
					`
							: ""
					}

					${
						hasMaxLength
							? `
					if (key.length > ${maxLen}) {
						failures.push("must be at most ${maxLen} characters");
					}
					`
							: ""
					}

					if (failures.length > 0) {
						ctx.addIssue({
							code: "custom",
							message: \`Property name '\${key}' \${failures.join(", ")}\`,
							path: [key]
						});
					}
				}
			})`;
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
