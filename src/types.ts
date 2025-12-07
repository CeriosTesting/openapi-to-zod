export interface GeneratorOptions {
	/**
	 * Object validation mode
	 * - 'strict': Uses z.strictObject() - no additional properties allowed
	 * - 'normal': Uses z.object() - additional properties allowed
	 * - 'loose': Uses z.looseObject() - explicitly allows additional properties
	 */
	mode?: "strict" | "normal" | "loose";

	/**
	 * Input OpenAPI YAML file path
	 */
	input: string;

	/**
	 * Output TypeScript file path
	 */
	output: string;

	/**
	 * Whether to include descriptions as JSDoc comments
	 */
	includeDescriptions?: boolean;

	/**
	 * Enum generation type
	 * - 'zod': Uses z.enum() with inferred types (default)
	 * - 'typescript': Uses TypeScript enums with z.enum() referencing them
	 */
	enumType?: "zod" | "typescript";

	/**
	 * Whether to add .describe() calls for better error messages
	 * @default false
	 */
	useDescribe?: boolean;

	/**
	 * Schema filtering mode
	 * - 'all': Generate all schemas (default)
	 * - 'request': Only include schemas suitable for requests (excludes readOnly)
	 * - 'response': Only include schemas suitable for responses (excludes writeOnly)
	 */
	schemaType?: "all" | "request" | "response";

	/**
	 * Prefix to add to all generated schema names
	 * @example "api" -> "apiUserSchema"
	 */
	prefix?: string;

	/**
	 * Suffix to add before "Schema" in generated names
	 * @example "dto" -> "userDtoSchema"
	 */
	suffix?: string;

	/**
	 * Whether to include generation statistics in output file
	 * @default true
	 */
	showStats?: boolean;
}

export interface OpenAPISchema {
	type?: string;
	format?: string;
	enum?: (string | number)[];
	const?: string | number | boolean | null;
	properties?: Record<string, OpenAPISchema>;
	required?: string[];
	items?: OpenAPISchema;
	prefixItems?: OpenAPISchema[];
	allOf?: OpenAPISchema[];
	oneOf?: OpenAPISchema[];
	anyOf?: OpenAPISchema[];
	$ref?: string;
	nullable?: boolean;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: boolean | number;
	exclusiveMaximum?: boolean | number;
	multipleOf?: number;
	pattern?: string;
	description?: string;
	title?: string;
	example?: any;
	examples?: any[];
	additionalProperties?: boolean | OpenAPISchema;
	minProperties?: number;
	maxProperties?: number;
	minItems?: number;
	maxItems?: number;
	uniqueItems?: boolean;
	contains?: OpenAPISchema;
	minContains?: number;
	maxContains?: number;
	discriminator?: {
		propertyName: string;
		mapping?: Record<string, string>;
	};
	readOnly?: boolean;
	writeOnly?: boolean;
	deprecated?: boolean;
	dependentRequired?: Record<string, string[]>;
	dependencies?: Record<string, string[] | OpenAPISchema>;
	patternProperties?: Record<string, OpenAPISchema>;
	propertyNames?: OpenAPISchema;
	contentMediaType?: string;
	contentEncoding?: string;
	not?: OpenAPISchema;
	if?: OpenAPISchema;
	then?: OpenAPISchema;
	else?: OpenAPISchema;
	unevaluatedProperties?: boolean | OpenAPISchema;
	unevaluatedItems?: boolean | OpenAPISchema;
}

export interface OpenAPISpec {
	components?: {
		schemas?: Record<string, OpenAPISchema>;
	};
}
