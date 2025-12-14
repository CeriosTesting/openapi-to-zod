import type { NamingOptions } from "../utils/name-utils";
import { toCamelCase, toPascalCase } from "../utils/name-utils";

export type EnumType = "zod" | "typescript";

export interface EnumOpenApiGeneratorOptions extends NamingOptions {
	enumType: EnumType;
}

export interface EnumResult {
	enumCode: string | null;
	schemaCode: string;
	typeCode: string;
}

/**
 * Generate enum as TypeScript enum or Zod enum
 */
export function generateEnum(
	name: string,
	values: (string | number)[],
	options: EnumOpenApiGeneratorOptions
): EnumResult {
	const enumName = name.endsWith("EnumOptions") ? name.replace("EnumOptions", "Enum") : `${name}Enum`;
	const schemaName = `${toCamelCase(name, options)}Schema`;

	if (options.enumType === "typescript") {
		// Generate TypeScript enum
		const usedKeys = new Set<string>();
		const enumEntries = values
			.map(value => {
				let key = toPascalCase(value);

				// Handle duplicate keys by appending a suffix
				if (usedKeys.has(key)) {
					let counter = 2;
					while (usedKeys.has(`${key}${counter}`)) {
						counter++;
					}
					key = `${key}${counter}`;
				}
				usedKeys.add(key);

				const stringValue = typeof value === "string" ? `"${value}"` : value;
				return `  ${key} = ${stringValue},`;
			})
			.join("\n");

		const enumCode = `export enum ${enumName} {\n${enumEntries}\n}`;
		const schemaCode = `export const ${schemaName} = z.nativeEnum(${enumName});`;
		const typeCode = `export type ${name} = z.infer<typeof ${schemaName}>;`;

		return { enumCode, schemaCode, typeCode };
	}

	// Generate Zod enum (default)
	// Note: z.enum only accepts string values, so convert numbers to strings
	const enumValues = values.map(v => `"${v}"`).join(", ");
	const schemaCode = `export const ${schemaName} = z.enum([${enumValues}]);`;
	const typeCode = `export type ${name} = z.infer<typeof ${schemaName}>;`;

	return { enumCode: null, schemaCode, typeCode };
}
