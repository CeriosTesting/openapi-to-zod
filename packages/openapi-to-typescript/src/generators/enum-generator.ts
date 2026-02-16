/**
 * Enum generator for TypeScript types
 *
 * Generates TypeScript enums, union types, or const objects from OpenAPI enum schemas
 */

import { applyFormatting, classifyEnumType, numericToEnumMember, stringToEnumMember } from "@cerios/openapi-core";

import type { EnumFormat } from "../types";

export interface EnumGeneratorOptions {
	format: EnumFormat;
	prefix?: string;
	suffix?: string;
	nullable?: boolean;
}

export interface EnumGeneratorResult {
	code: string;
	typeName: string;
}

/**
 * Generate TypeScript code for an enum schema
 */
export function generateEnum(
	name: string,
	values: (string | number | boolean)[],
	options: EnumGeneratorOptions
): EnumGeneratorResult {
	const { format, prefix, suffix, nullable } = options;
	const typeName = applyFormatting(name, prefix, suffix);

	let result: EnumGeneratorResult;
	switch (format) {
		case "enum":
			result = generateTsEnum(typeName, values);
			break;
		case "union":
			result = generateUnion(typeName, values);
			break;
		case "const-object":
			result = generateConstObject(typeName, values);
			break;
		default:
			result = generateUnion(typeName, values);
	}

	// Add | null to the type if nullable
	if (nullable) {
		result.code = addNullableToTypeCode(result.code, typeName);
	}

	return result;
}

/**
 * Add | null to the type declaration in the generated code
 */
function addNullableToTypeCode(code: string, typeName: string): string {
	// Handle union types: export type TypeName = "a" | "b";
	// -> export type TypeName = "a" | "b" | null;
	const unionPattern = new RegExp(`(export type ${typeName} = )([^;]+)(;)`);
	if (unionPattern.test(code)) {
		return code.replace(unionPattern, `$1$2 | null$3`);
	}

	// Handle const-object: export type TypeName = (typeof TypeName)[keyof typeof TypeName];
	// -> export type TypeName = (typeof TypeName)[keyof typeof TypeName] | null;
	const constObjectTypePattern = new RegExp(
		`(export type ${typeName} = \\(typeof ${typeName}\\)\\[keyof typeof ${typeName}\\])(;)`
	);
	if (constObjectTypePattern.test(code)) {
		return code.replace(constObjectTypePattern, `$1 | null$2`);
	}

	// Handle TS enum - enums can't directly include null in their declaration,
	// so we add a nullable type alias that users can use for nullable type annotations
	const enumPattern = /^export enum /;
	if (enumPattern.test(code)) {
		return `${code}\n/** Nullable version of ${typeName} enum */\nexport type ${typeName}Nullable = ${typeName} | null;`;
	}

	return code;
}

/**
 * Generate a TypeScript enum
 */
function generateTsEnum(typeName: string, values: (string | number | boolean)[]): EnumGeneratorResult {
	const enumType = classifyEnumType(values);

	// For boolean enums, we can't use TS enum - fall back to union
	if (enumType === "boolean") {
		return generateUnion(typeName, values);
	}

	// Track used keys to prevent duplicates
	const usedKeys = new Set<string>();

	const members = values.map(value => {
		if (typeof value === "string") {
			// Convert value to valid enum member name with deduplication
			const memberName = stringToEnumMember(value, usedKeys);
			return `  ${memberName} = "${value}"`;
		}
		if (typeof value === "number") {
			const memberName = numericToEnumMember(value, usedKeys);
			return `  ${memberName} = ${value}`;
		}
		// Booleans handled above
		return `  ${String(value)} = ${value}`;
	});

	const code = `export enum ${typeName} {\n${members.join(",\n")},\n}`;
	return { code, typeName };
}

/**
 * Generate a TypeScript union type
 */
function generateUnion(typeName: string, values: (string | number | boolean)[]): EnumGeneratorResult {
	const literals = values.map(value => {
		if (typeof value === "string") {
			return `"${value}"`;
		}
		if (typeof value === "boolean") {
			return String(value);
		}
		return String(value);
	});

	const code = `export type ${typeName} = ${literals.join(" | ")};`;
	return { code, typeName };
}

/**
 * Generate a const object with derived type
 */
function generateConstObject(typeName: string, values: (string | number | boolean)[]): EnumGeneratorResult {
	const enumType = classifyEnumType(values);

	// For boolean enums, fall back to union
	if (enumType === "boolean") {
		return generateUnion(typeName, values);
	}

	// Track used keys to prevent duplicates
	const usedKeys = new Set<string>();

	const members = values.map(value => {
		if (typeof value === "string") {
			const memberName = stringToEnumMember(value, usedKeys);
			return `  ${memberName}: "${value}"`;
		}
		if (typeof value === "number") {
			const memberName = numericToEnumMember(value, usedKeys);
			return `  ${memberName}: ${value}`;
		}
		return `  ${String(value)}: ${value}`;
	});

	const objectCode = `export const ${typeName} = {\n${members.join(",\n")},\n} as const;`;
	const typeCode = `export type ${typeName} = (typeof ${typeName})[keyof typeof ${typeName}];`;
	const code = `${objectCode}\n${typeCode}`;

	return { code, typeName };
}
