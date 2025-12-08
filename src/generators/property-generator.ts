import type { NativeEnumType, OpenAPISchema, OpenAPISpec, TypeMode } from "../types";
import type { NamingOptions } from "../utils/name-utils";
import { resolveRef, toCamelCase } from "../utils/name-utils";
import { addDescription, getPrimaryType, hasMultipleTypes, isNullable, wrapNullable } from "../utils/string-utils";
import { generateArrayValidation } from "../validators/array-validator";
import { generateAllOf, generateUnion } from "../validators/composition-validator";
import { generateNumberValidation } from "../validators/number-validator";
import type { ObjectMode } from "../validators/object-validator";
import { generateObjectSchema } from "../validators/object-validator";
import { generateStringValidation } from "../validators/string-validator";

export interface PropertyGeneratorContext {
	spec: OpenAPISpec;
	schemaDependencies: Map<string, Set<string>>;
	schemaType: "all" | "request" | "response";
	mode: ObjectMode;
	includeDescriptions: boolean;
	useDescribe: boolean;
	typeMode: TypeMode;
	nativeEnumType: NativeEnumType;
	namingOptions: NamingOptions;
}

/**
 * Property schema generator with memoization for performance
 */
export class PropertyGenerator {
	private context: PropertyGeneratorContext;
	// Performance optimization: Memoize filtered property results
	private filteredPropsCache = new Map<string, OpenAPISchema>();

	// Performance optimization: Lookup table for faster inclusion checks
	static readonly INCLUSION_RULES = {
		request: (schema: OpenAPISchema) => !schema.readOnly,
		response: (schema: OpenAPISchema) => !schema.writeOnly,
		all: () => true,
	} as const;

	constructor(context: PropertyGeneratorContext) {
		this.context = context;
	}

	/**
	 * Check if a property should be included based on schemaType and readOnly/writeOnly flags
	 */
	shouldIncludeProperty(schema: OpenAPISchema): boolean {
		const rule = PropertyGenerator.INCLUSION_RULES[this.context.schemaType];
		return rule(schema);
	}

	/**
	 * Recursively filter any schema type (helper for composition schemas)
	 */
	private filterSchemaRecursive(schema: OpenAPISchema): OpenAPISchema {
		if (schema.$ref) {
			// Don't filter refs, they'll be filtered when resolved
			return schema;
		}

		if (schema.properties) {
			return this.filterNestedProperties(schema);
		}

		if (schema.type === "array" && schema.items && typeof schema.items === "object" && schema.items.properties) {
			return {
				...schema,
				items: this.filterNestedProperties(schema.items),
			};
		}

		return schema;
	}

	/**
	 * Recursively filter properties in nested objects based on readOnly/writeOnly
	 * Performance optimized with memoization
	 */
	private filterNestedProperties(schema: OpenAPISchema): OpenAPISchema {
		// Performance optimization: More efficient cache key generation
		const propKeys = schema.properties ? Object.keys(schema.properties).sort().join(",") : "";
		const cacheKey = `${this.context.schemaType}:${schema.type || "unknown"}:${propKeys}:${schema.required?.join(",") || ""}`;
		const cached = this.filteredPropsCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		if (!schema.properties) {
			return schema;
		}

		const filteredProperties: Record<string, OpenAPISchema> = {};
		const filteredRequired: string[] = [];

		for (const [propName, propSchema] of Object.entries(schema.properties)) {
			if (!this.shouldIncludeProperty(propSchema)) {
				continue;
			}

			// Recursively filter nested structures
			let filteredPropSchema = propSchema;

			if (propSchema.type === "object" && propSchema.properties) {
				// Nested object
				filteredPropSchema = this.filterNestedProperties(propSchema);
			} else if (
				propSchema.type === "array" &&
				propSchema.items &&
				typeof propSchema.items === "object" &&
				propSchema.items.properties
			) {
				// Array of objects
				filteredPropSchema = {
					...propSchema,
					items: this.filterNestedProperties(propSchema.items),
				};
			} else if (propSchema.allOf || propSchema.oneOf || propSchema.anyOf) {
				// Composition schemas - filter each branch
				if (propSchema.allOf) {
					filteredPropSchema = {
						...propSchema,
						allOf: propSchema.allOf.map(s => this.filterSchemaRecursive(s)),
					};
				} else if (propSchema.oneOf) {
					filteredPropSchema = {
						...propSchema,
						oneOf: propSchema.oneOf.map(s => this.filterSchemaRecursive(s)),
					};
				} else if (propSchema.anyOf) {
					filteredPropSchema = {
						...propSchema,
						anyOf: propSchema.anyOf.map(s => this.filterSchemaRecursive(s)),
					};
				}
			}

			filteredProperties[propName] = filteredPropSchema;

			// Keep required status if property is included
			if (schema.required?.includes(propName)) {
				filteredRequired.push(propName);
			}
		}

		const result = {
			...schema,
			properties: filteredProperties,
			required: filteredRequired.length > 0 ? filteredRequired : undefined,
		};

		// Cache the result
		this.filteredPropsCache.set(cacheKey, result);
		return result;
	}

	/**
	 * Resolve discriminator mapping to actual schema references
	 */
	private resolveDiscriminatorMapping(mapping: Record<string, string>, schemas: OpenAPISchema[]): OpenAPISchema[] {
		// If mapping is provided, use it to reorder/filter schemas
		// The mapping maps discriminator values to schema references
		const mappedSchemas: OpenAPISchema[] = [];

		for (const [_, schemaRef] of Object.entries(mapping)) {
			// Find the schema that matches this reference
			const matchingSchema = schemas.find(s => {
				if (s.$ref) {
					// Check if the ref matches
					return s.$ref === schemaRef || s.$ref.endsWith(schemaRef);
				}
				return false;
			});

			if (matchingSchema) {
				mappedSchemas.push(matchingSchema);
			} else {
				// Schema not found in oneOf/anyOf, create a reference
				mappedSchemas.push({ $ref: schemaRef });
			}
		}

		// Include any schemas that weren't in the mapping
		for (const schema of schemas) {
			if (!mappedSchemas.includes(schema)) {
				mappedSchemas.push(schema);
			}
		}

		return mappedSchemas;
	}

	/**
	 * Check if this is a circular dependency through aliases
	 */
	private isCircularThroughAlias(fromSchema: string, toSchema: string): boolean {
		const toSchemaSpec = this.context.spec.components?.schemas?.[toSchema];
		if (!toSchemaSpec) return false;

		// Check if toSchema is a simple alias (allOf with single $ref)
		if (toSchemaSpec.allOf && toSchemaSpec.allOf.length === 1 && toSchemaSpec.allOf[0].$ref) {
			const aliasTarget = resolveRef(toSchemaSpec.allOf[0].$ref);
			// If the alias points back to the original schema, it's circular
			return aliasTarget === fromSchema;
		}

		return false;
	}

	/**
	 * Generate union for multiple types (OpenAPI 3.1)
	 */
	private generateMultiTypeUnion(schema: OpenAPISchema, currentSchema?: string): string {
		if (!Array.isArray(schema.type)) {
			return "z.unknown()";
		}
		const nonNullTypes = schema.type.filter(t => t !== "null");
		const schemas = nonNullTypes.map(type => {
			const typeSchema = { ...schema, type };
			return this.generatePropertySchema(typeSchema, currentSchema);
		});
		return `z.union([${schemas.join(", ")}])`;
	}

	/**
	 * Apply unevaluatedProperties validation to a schema
	 */
	private applyUnevaluatedProperties(baseSchema: string, schema: OpenAPISchema): string {
		// Collect all evaluated properties from the schema and its composition
		const evaluatedProps = new Set<string>();

		// Add properties from this schema
		if (schema.properties) {
			for (const propName of Object.keys(schema.properties)) {
				evaluatedProps.add(propName);
			}
		}

		// Add properties from allOf/oneOf/anyOf (shallow scan)
		const collectPropsFromComposition = (schemas?: OpenAPISchema[]) => {
			if (!schemas) return;
			for (const subSchema of schemas) {
				if (subSchema.properties) {
					for (const propName of Object.keys(subSchema.properties)) {
						evaluatedProps.add(propName);
					}
				}
				// Also check $ref schemas
				if (subSchema.$ref) {
					const refSchema = this.context.spec.components?.schemas?.[subSchema.$ref.split("/").pop() || ""];
					if (refSchema?.properties) {
						for (const propName of Object.keys(refSchema.properties)) {
							evaluatedProps.add(propName);
						}
					}
				}
			}
		};
		collectPropsFromComposition(schema.allOf);
		collectPropsFromComposition(schema.oneOf);
		collectPropsFromComposition(schema.anyOf);

		const evaluatedPropsSet = `new Set(${JSON.stringify([...evaluatedProps])})`;

		// For unions (oneOf/anyOf), we need to add .passthrough() to EACH branch
		// For allOf with merge(), add passthrough to the final result
		let schemaWithPassthrough = baseSchema;
		if (baseSchema.includes(".union([") || baseSchema.includes(".discriminatedUnion(")) {
			// For unions, we need to make each branch passthrough
			// This is complex, so we'll apply refinement and let the refinement check the raw input
			// The union will have already validated structure, refinement checks extra props
			schemaWithPassthrough = baseSchema;
		} else if (baseSchema.includes(".merge(")) {
			// Wrap in passthrough - apply to final result
			schemaWithPassthrough = `${baseSchema}.passthrough()`;
		}

		if (schema.unevaluatedProperties === false) {
			// No unevaluated properties allowed
			return `${schemaWithPassthrough}.refine((obj) => Object.keys(obj).every(key => ${evaluatedPropsSet}.has(key)), { message: "No unevaluated properties allowed" })`;
		} else if (typeof schema.unevaluatedProperties === "object") {
			// Unevaluated properties must match schema
			const unevalSchema = this.generatePropertySchema(schema.unevaluatedProperties);
			return `${schemaWithPassthrough}.refine((obj) => Object.keys(obj).filter(key => !${evaluatedPropsSet}.has(key)).every(key => ${unevalSchema}.safeParse(obj[key]).success), { message: "Unevaluated properties must match the schema" })`;
		}

		return baseSchema;
	}

	/**
	 * Generate Zod schema for a property
	 */
	generatePropertySchema(schema: OpenAPISchema, currentSchema?: string, isTopLevel = false): string {
		// Apply nested property filtering if needed
		if ((this.context.schemaType === "request" || this.context.schemaType === "response") && schema.properties) {
			schema = this.filterNestedProperties(schema);
		}

		const nullable = isNullable(schema);

		// Handle multiple types (OpenAPI 3.1)
		if (hasMultipleTypes(schema)) {
			const union = this.generateMultiTypeUnion(schema, currentSchema);
			return wrapNullable(union, nullable);
		}

		// Handle $ref
		if (schema.$ref) {
			const refName = resolveRef(schema.$ref);
			// Track dependency (but not if it's just an alias at top level)
			if (currentSchema && refName !== currentSchema && !isTopLevel) {
				if (!this.context.schemaDependencies.has(currentSchema)) {
					this.context.schemaDependencies.set(currentSchema, new Set());
				}
				this.context.schemaDependencies.get(currentSchema)?.add(refName);
			}
			const schemaName = `${toCamelCase(refName, this.context.namingOptions)}Schema`;

			// Check for circular dependency through alias
			if (currentSchema && this.isCircularThroughAlias(currentSchema, refName)) {
				// Use lazy evaluation for circular references with explicit type annotation
				const lazySchema = `z.lazy((): z.ZodTypeAny => ${schemaName})`;
				return wrapNullable(lazySchema, nullable);
			}

			return wrapNullable(schemaName, nullable);
		}

		// Handle const (literal values)
		if (schema.const !== undefined) {
			const literalValue = typeof schema.const === "string" ? `"${schema.const}"` : schema.const;
			const zodLiteral = `z.literal(${literalValue})`;
			return wrapNullable(zodLiteral, nullable);
		}

		// Handle enum
		if (schema.enum) {
			const enumValues = schema.enum.map(v => `"${v}"`).join(", ");
			const zodEnum = `z.enum([${enumValues}])`;
			return wrapNullable(zodEnum, nullable);
		}

		// Handle allOf
		if (schema.allOf) {
			let composition = generateAllOf(
				schema.allOf,
				nullable,
				{ generatePropertySchema: this.generatePropertySchema.bind(this) },
				currentSchema
			);

			// Apply unevaluatedProperties if specified
			if (schema.unevaluatedProperties !== undefined) {
				composition = this.applyUnevaluatedProperties(composition, schema);
			}

			return composition;
		}

		// Handle oneOf with discriminator support
		if (schema.oneOf) {
			const needsPassthrough = schema.unevaluatedProperties !== undefined;
			let composition = generateUnion(
				schema.oneOf,
				schema.discriminator?.propertyName,
				nullable,
				{
					generatePropertySchema: this.generatePropertySchema.bind(this),
					resolveDiscriminatorMapping: this.resolveDiscriminatorMapping.bind(this),
				},
				{
					passthrough: needsPassthrough,
					discriminatorMapping: schema.discriminator?.mapping,
				}
			);

			// Apply unevaluatedProperties if specified
			if (schema.unevaluatedProperties !== undefined) {
				composition = this.applyUnevaluatedProperties(composition, schema);
			}

			return composition;
		}

		// Handle anyOf with discriminator support
		if (schema.anyOf) {
			const needsPassthrough = schema.unevaluatedProperties !== undefined;
			let composition = generateUnion(
				schema.anyOf,
				schema.discriminator?.propertyName,
				nullable,
				{
					generatePropertySchema: this.generatePropertySchema.bind(this),
					resolveDiscriminatorMapping: this.resolveDiscriminatorMapping.bind(this),
				},
				{
					passthrough: needsPassthrough,
					discriminatorMapping: schema.discriminator?.mapping,
				}
			);

			// Apply unevaluatedProperties if specified
			if (schema.unevaluatedProperties !== undefined) {
				composition = this.applyUnevaluatedProperties(composition, schema);
			}

			return composition;
		}

		// Handle not keyword (must be after compositions)
		if (schema.not) {
			const notSchema = this.generatePropertySchema(schema.not, currentSchema);
			let baseValidation: string;

			// If schema has a type, generate validation for that type first
			if (schema.type || schema.properties || schema.items) {
				// Create a copy without 'not' to generate base validation
				const { not: _, ...baseSchema } = schema;
				baseValidation = this.generatePropertySchema(baseSchema, currentSchema);
			} else {
				// No specific type, use unknown
				baseValidation = "z.unknown()";
			}

			const refined = `${baseValidation}.refine((val) => !${notSchema}.safeParse(val).success, { message: "Value must not match the excluded schema" })`;
			return wrapNullable(refined, nullable);
		}

		let validation = "";
		const primaryType = getPrimaryType(schema);

		switch (primaryType) {
			case "string":
				validation = generateStringValidation(schema, this.context.useDescribe);
				break;

			case "number":
				validation = generateNumberValidation(schema, false, this.context.useDescribe);
				break;

			case "integer":
				validation = generateNumberValidation(schema, true, this.context.useDescribe);
				break;

			case "boolean":
				validation = "z.boolean()";
				validation = addDescription(validation, schema.description, this.context.useDescribe);
				break;

			case "array":
				validation = generateArrayValidation(schema, {
					generatePropertySchema: this.generatePropertySchema.bind(this),
					useDescribe: this.context.useDescribe,
					currentSchema,
				});
				break;

			case "object":
				if (
					schema.properties ||
					schema.required ||
					schema.minProperties !== undefined ||
					schema.maxProperties !== undefined ||
					schema.patternProperties ||
					schema.propertyNames
				) {
					validation = generateObjectSchema(
						schema,
						{
							generatePropertySchema: this.generatePropertySchema.bind(this),
							shouldIncludeProperty: this.shouldIncludeProperty.bind(this),
							mode: this.context.mode,
							includeDescriptions: this.context.includeDescriptions,
							useDescribe: this.context.useDescribe,
						},
						currentSchema
					);
					validation = addDescription(validation, schema.description, this.context.useDescribe);
				} else {
					validation = "z.record(z.string(), z.unknown())";
					validation = addDescription(validation, schema.description, this.context.useDescribe);
				}
				break;
			default:
				validation = "z.unknown()";
				validation = addDescription(validation, schema.description, this.context.useDescribe);
		}

		return wrapNullable(validation, nullable);
	}
}
