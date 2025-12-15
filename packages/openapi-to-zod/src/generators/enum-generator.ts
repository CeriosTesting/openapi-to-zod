import type { NamingOptions } from "../utils/name-utils";
import { toCamelCase } from "../utils/name-utils";

export interface EnumOpenApiGeneratorOptions extends NamingOptions {}

export interface EnumResult {
	schemaCode: string;
	typeCode: string;
}

/**
 * Generate Zod enum schema
 * Always generates z.enum() with inferred types
 */
export function generateEnum(
	name: string,
	values: (string | number)[],
	options: EnumOpenApiGeneratorOptions
): EnumResult {
	const schemaName = `${toCamelCase(name, options)}Schema`;

	// Generate Zod enum - z.enum only accepts string values, so convert numbers to strings
	const enumValues = values.map(v => `"${v}"`).join(", ");
	const schemaCode = `export const ${schemaName} = z.enum([${enumValues}]);`;
	const typeCode = `export type ${name} = z.infer<typeof ${schemaName}>;`;

	return { schemaCode, typeCode };
}
