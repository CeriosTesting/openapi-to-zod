import type { NamingOptions } from "../utils/name-utils";
import { toCamelCase, toPascalCase } from "../utils/name-utils";

export interface EnumOpenApiGeneratorOptions extends NamingOptions {}

export interface EnumResult {
	schemaCode: string;
	typeCode: string;
}

/**
 * Generate Zod enum schema
 * - String-only enums: z.enum()
 * - Numeric enums: z.union([z.literal(), ...])
 * - Boolean enums: z.boolean()
 * - Mixed enums: z.union([z.literal(), ...])
 */
export function generateEnum(
	name: string,
	values: (string | number | boolean)[],
	options: EnumOpenApiGeneratorOptions
): EnumResult {
	const schemaName = `${toCamelCase(name, options)}Schema`;
	const typeName = toPascalCase(name);

	// Check if all values are booleans
	const allBooleans = values.every(v => typeof v === "boolean");
	if (allBooleans) {
		// For boolean enums, use z.boolean()
		const schemaCode = `export const ${schemaName} = z.boolean();`;
		const typeCode = `export type ${typeName} = z.infer<typeof ${schemaName}>;`;
		return { schemaCode, typeCode };
	}

	// Check if all values are strings
	const allStrings = values.every(v => typeof v === "string");
	if (allStrings) {
		// z.enum only accepts string values
		const enumValues = values.map(v => `"${v}"`).join(", ");
		const schemaCode = `export const ${schemaName} = z.enum([${enumValues}]);`;
		const typeCode = `export type ${typeName} = z.infer<typeof ${schemaName}>;`;
		return { schemaCode, typeCode };
	}

	// For numeric or mixed enums, use z.union with z.literal
	const literalValues = values
		.map(v => {
			if (typeof v === "string") {
				return `z.literal("${v}")`;
			}
			return `z.literal(${v})`;
		})
		.join(", ");

	const schemaCode = `export const ${schemaName} = z.union([${literalValues}]);`;
	const typeCode = `export type ${typeName} = z.infer<typeof ${schemaName}>;`;

	return { schemaCode, typeCode };
}
