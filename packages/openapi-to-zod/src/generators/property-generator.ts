import {
	getPrimaryType,
	hasMultipleTypes,
	isNullable,
	LRUCache,
	type NamingOptions,
	resolveRefName,
	stripPrefix,
	toCamelCase,
	toPascalCase,
} from "@cerios/openapi-core";

import type { OpenAPISchema, OpenAPISpec } from "../types";
import { addDescription, wrapNullable } from "../utils/string-utils";
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
	namingOptions: NamingOptions;
	stripSchemaPrefix?: string | string[];
	/**
	 * Default nullable behavior when not explicitly specified
	 * @default false
	 */
	defaultNullable: boolean;
	/**
	 * Behavior for empty object schemas (objects with no properties defined)
	 * @default 'loose'
	 */
	emptyObjectBehavior: "strict" | "loose" | "record";
	/**
	 * Zod validation string for date-time format fields
	 * @default "z.iso.datetime()"
	 */
	dateTimeValidation: string;
	/**
	 * Instance-level cache for escaped regex patterns (parallel-safe)
	 */
	patternCache: LRUCache<string, string>;
	/**
	 * Whether types are generated in a separate file (imported) vs inline (z.infer)
	 * When true, z.lazy uses z.ZodType<TypeName> for proper type inference
	 * When false, z.lazy uses z.ZodTypeAny to avoid circular type references
	 * @default false
	 */
	separateTypesFile: boolean;
}

/**
 * Property schema generator with memoization for performance
 */
export class PropertyGenerator {
	private context: PropertyGeneratorContext;
	// Performance optimization: Memoize filtered property results
	private filteredPropsCache = new Map<string, OpenAPISchema>();
	// Performance optimization: LRU cache for generated schemas
	private schemaCache = new LRUCache<string, string>(500);
	// Track allOf conflicts detected during schema generation
	private allOfConflicts: string[] = [];
	// Schemas that are part of circular dependency chains (need z.lazy for forward refs)
	private circularDependencies: Set<string> = new Set();

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
	 * Set the schemas that are involved in circular dependency chains.
	 * These schemas will use z.lazy() for forward references.
	 */
	setCircularDependencies(deps: Set<string>): void {
		this.circularDependencies = deps;
	}

	/**
	 * Get allOf conflicts detected during the last schema generation
	 * @returns Array of conflict description strings
	 */
	getAllOfConflicts(): string[] {
		return [...this.allOfConflicts];
	}

	/**
	 * Clear tracked allOf conflicts (call before generating a new schema)
	 */
	clearAllOfConflicts(): void {
		this.allOfConflicts = [];
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
		const requiredKeys = Array.isArray(schema.required) ? schema.required.join(",") : String(schema.required ?? "");
		const schemaType = Array.isArray(schema.type) ? schema.type.join("|") : schema.type || "unknown";
		const cacheKey = `${this.context.schemaType}:${schemaType}:${propKeys}:${requiredKeys}`;
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
	 * Resolve a $ref string to the actual schema
	 */
	private resolveSchemaRef(ref: string): OpenAPISchema | undefined {
		const schemaName = ref.split("/").pop();
		if (!schemaName) return undefined;
		return this.context.spec.components?.schemas?.[schemaName];
	}

	/**
	 * Resolve a schema name through any aliases to get the actual schema name
	 * If the schema is an alias (allOf with single $ref), return the target name
	 */
	private resolveSchemaAlias(schemaName: string): string {
		const schema = this.context.spec.components?.schemas?.[schemaName];
		if (!schema) return schemaName;

		// Check if this is a simple alias (allOf with single $ref and nothing else)
		if (
			schema.allOf &&
			schema.allOf.length === 1 &&
			schema.allOf[0].$ref &&
			!schema.properties &&
			!schema.oneOf &&
			!schema.anyOf
		) {
			const targetName = resolveRefName(schema.allOf[0].$ref);
			// Recursively resolve in case of chained aliases
			return this.resolveSchemaAlias(targetName);
		}

		return schemaName;
	}

	/**
	 * Check if this is a circular dependency through aliases
	 */
	private isCircularThroughAlias(fromSchema: string, toSchema: string): boolean {
		const toSchemaSpec = this.context.spec.components?.schemas?.[toSchema];
		if (!toSchemaSpec) return false;

		// Check if toSchema is a simple alias (allOf with single $ref)
		if (toSchemaSpec.allOf && toSchemaSpec.allOf.length === 1 && toSchemaSpec.allOf[0].$ref) {
			const aliasTarget = resolveRefName(toSchemaSpec.allOf[0].$ref);
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

		// For unions (oneOf/anyOf), we need to add .catchall(z.unknown()) to EACH branch
		// For allOf with extend(), add catchall to the final result
		let schemaWithCatchall = baseSchema;
		if (baseSchema.includes(".union([") || baseSchema.includes(".discriminatedUnion(")) {
			// For unions, we need to make each branch allow additional properties
			// This is complex, so we'll apply refinement and let the refinement check the raw input
			// The union will have already validated structure, refinement checks extra props
			schemaWithCatchall = baseSchema;
		} else if (baseSchema.includes(".extend(")) {
			// Wrap in catchall - apply to final result
			schemaWithCatchall = `${baseSchema}.catchall(z.unknown())`;
		}

		if (schema.unevaluatedProperties === false) {
			// No unevaluated properties allowed
			return `${schemaWithCatchall}.refine((obj) => Object.keys(obj).every(key => ${evaluatedPropsSet}.has(key)), { message: "No unevaluated properties allowed" })`;
		} else if (typeof schema.unevaluatedProperties === "object") {
			// Unevaluated properties must match schema
			const unevalSchema = this.generatePropertySchema(schema.unevaluatedProperties);
			return `${schemaWithCatchall}.refine((obj) => Object.keys(obj).filter(key => !${evaluatedPropsSet}.has(key)).every(key => ${unevalSchema}.safeParse(obj[key]).success), { message: "Unevaluated properties must match the schema" })`;
		}

		return baseSchema;
	}

	/**
	 * Generate Zod schema for a property
	 * @param schema - The OpenAPI schema to generate
	 * @param currentSchema - The name of the current schema being processed (for circular ref detection)
	 * @param isTopLevel - Whether this is a top-level schema definition
	 * @param suppressDefaultNullable - When true, don't apply defaultNullable (used when outer schema has explicit nullable: false)
	 */
	generatePropertySchema(
		schema: OpenAPISchema,
		currentSchema?: string,
		isTopLevel = false,
		suppressDefaultNullable = false
	): string {
		// Performance optimization: Check cache for simple schemas
		// Only cache schemas without $ref or complex compositions to avoid stale circular refs
		const isCacheable = !schema.$ref && !schema.allOf && !schema.oneOf && !schema.anyOf && !currentSchema;
		if (isCacheable) {
			const cacheKey = JSON.stringify({
				schema,
				type: this.context.schemaType,
				mode: this.context.mode,
				suppressDefaultNullable,
			});
			const cached = this.schemaCache.get(cacheKey);
			if (cached) {
				return cached;
			}
		}

		// Apply nested property filtering if needed
		if ((this.context.schemaType === "request" || this.context.schemaType === "response") && schema.properties) {
			schema = this.filterNestedProperties(schema);
		}

		// Determine if defaultNullable should apply to this schema.
		// defaultNullable should apply to property values within objects, NOT to:
		// 1. Top-level schema definitions (isTopLevel = true)
		// 2. Enum values - enums define discrete values and shouldn't be nullable by default
		// 3. Const/literal values - these are exact values and shouldn't be nullable by default
		// 4. When suppressDefaultNullable is true (outer schema has explicit nullable: false)
		//
		// Note: $ref properties DO respect defaultNullable. If you want a non-nullable
		// reference when defaultNullable is true, you must explicitly add `nullable: false`
		// to the schema containing the $ref.
		const isEnum = !!schema.enum;
		const isConst = schema.const !== undefined;
		const shouldApplyDefaultNullable = !isTopLevel && !isEnum && !isConst && !suppressDefaultNullable;
		const effectiveDefaultNullable = shouldApplyDefaultNullable ? this.context.defaultNullable : false;
		const nullable = isNullable(schema, effectiveDefaultNullable);

		// Handle multiple types (OpenAPI 3.1)
		if (hasMultipleTypes(schema)) {
			const union = this.generateMultiTypeUnion(schema, currentSchema);
			return wrapNullable(union, nullable);
		}

		// Handle $ref
		if (schema.$ref) {
			const refName = resolveRefName(schema.$ref);
			// Resolve through any aliases to get the actual schema
			const resolvedRefName = this.resolveSchemaAlias(refName);

			// Track dependency (but not if it's just an alias at top level)
			if (currentSchema && refName !== currentSchema && !isTopLevel) {
				if (!this.context.schemaDependencies.has(currentSchema)) {
					this.context.schemaDependencies.set(currentSchema, new Set());
				}
				this.context.schemaDependencies.get(currentSchema)?.add(refName);
			}
			// Use the resolved name for the schema reference
			// Apply stripSchemaPrefix to get consistent schema names
			const strippedRefName = stripPrefix(resolvedRefName, this.context.stripSchemaPrefix);
			const schemaName = `${toCamelCase(strippedRefName, this.context.namingOptions)}Schema`;
			const typeName = toPascalCase(strippedRefName);

			// Check for direct self-reference, circular dependency through alias,
			// or mutual circular dependency (both schemas are part of a circular chain)
			const isDirectSelfRef = currentSchema && refName === currentSchema;
			const isCircularAlias = currentSchema && this.isCircularThroughAlias(currentSchema, refName);
			// Only use lazy for refs within a circular chain when BOTH schemas are circular.
			// If only the target is circular (e.g., self-referencing), the current schema
			// referencing it doesn't need lazy because the target is defined first in
			// topological sort order.
			const isMutuallyCircular =
				currentSchema && this.circularDependencies.has(currentSchema) && this.circularDependencies.has(refName);

			if (isDirectSelfRef || isCircularAlias || isMutuallyCircular) {
				// Use lazy evaluation for circular references
				// When types are in a separate file (imported), use z.ZodType<TypeName> for proper type inference
				// When types are inline (z.infer), use z.ZodTypeAny to avoid circular type references
				const lazyTypeAnnotation = this.context.separateTypesFile ? `z.ZodType<${typeName}>` : "z.ZodTypeAny";
				const lazySchema = `z.lazy((): ${lazyTypeAnnotation} => ${schemaName})`;
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
			// Check if all values are booleans
			const allBooleans = schema.enum.every(v => typeof v === "boolean");
			if (allBooleans) {
				const zodBoolean = "z.boolean()";
				return wrapNullable(zodBoolean, nullable);
			}

			// Check if all values are strings
			const allStrings = schema.enum.every(v => typeof v === "string");
			if (allStrings) {
				const enumValues = schema.enum.map(v => `"${v}"`).join(", ");
				const zodEnum = `z.enum([${enumValues}])`;
				return wrapNullable(zodEnum, nullable);
			}

			// For numeric or mixed enums, use z.union with z.literal
			const literalValues = schema.enum
				.map(v => {
					if (typeof v === "string") {
						return `z.literal("${v}")`;
					}
					return `z.literal(${v})`;
				})
				.join(", ");
			const zodUnion = `z.union([${literalValues}])`;
			return wrapNullable(zodUnion, nullable);
		}

		// Handle allOf
		if (schema.allOf) {
			// For allOf compositions, only apply nullable if explicitly set on the schema.
			// defaultNullable should NOT apply to composition results - they define schema shapes,
			// not property values. The .nullable() on individual properties inside the composition
			// is handled by generateInlineObjectShape which respects defaultNullable.
			const compositionNullable = isNullable(schema, false);
			const allOfResult = generateAllOf(
				schema.allOf,
				compositionNullable,
				{
					generatePropertySchema: this.generatePropertySchema.bind(this),
					generateInlineObjectShape: this.generateInlineObjectShape.bind(this),
					resolveSchemaRef: this.resolveSchemaRef.bind(this),
				},
				currentSchema
			);

			// Track any conflicts detected
			if (allOfResult.conflicts.length > 0) {
				this.allOfConflicts.push(...allOfResult.conflicts);
			}

			let composition = allOfResult.schema;

			// Apply unevaluatedProperties if specified
			if (schema.unevaluatedProperties !== undefined) {
				composition = this.applyUnevaluatedProperties(composition, schema);
			}

			return composition;
		}

		// Handle oneOf with discriminator support
		if (schema.oneOf) {
			// For oneOf compositions, only apply nullable if explicitly set on the schema.
			// defaultNullable should NOT apply to composition results.
			const compositionNullable = isNullable(schema, false);
			const needsPassthrough = schema.unevaluatedProperties !== undefined;
			let composition = generateUnion(
				schema.oneOf,
				schema.discriminator?.propertyName,
				compositionNullable,
				{
					generatePropertySchema: this.generatePropertySchema.bind(this),
					resolveDiscriminatorMapping: this.resolveDiscriminatorMapping.bind(this),
					resolveSchemaRef: this.resolveSchemaRef.bind(this),
				},
				{
					passthrough: needsPassthrough,
					discriminatorMapping: schema.discriminator?.mapping,
				},
				currentSchema
			);

			// Apply unevaluatedProperties if specified
			if (schema.unevaluatedProperties !== undefined) {
				composition = this.applyUnevaluatedProperties(composition, schema);
			}

			return composition;
		}

		// Handle anyOf with discriminator support
		if (schema.anyOf) {
			// For anyOf compositions, only apply nullable if explicitly set on the schema.
			// defaultNullable should NOT apply to composition results.
			const compositionNullable = isNullable(schema, false);
			const needsPassthrough = schema.unevaluatedProperties !== undefined;
			let composition = generateUnion(
				schema.anyOf,
				schema.discriminator?.propertyName,
				compositionNullable,
				{
					generatePropertySchema: this.generatePropertySchema.bind(this),
					resolveDiscriminatorMapping: this.resolveDiscriminatorMapping.bind(this),
					resolveSchemaRef: this.resolveSchemaRef.bind(this),
				},
				{
					passthrough: needsPassthrough,
					discriminatorMapping: schema.discriminator?.mapping,
				},
				currentSchema
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
				validation = generateStringValidation(schema, this.context.useDescribe, {
					dateTimeValidation: this.context.dateTimeValidation,
					patternCache: this.context.patternCache,
				});
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
					// Empty object schema - behavior controlled by emptyObjectBehavior option
					switch (this.context.emptyObjectBehavior) {
						case "strict":
							validation = "z.strictObject({})";
							break;
						case "loose":
							validation = "z.looseObject({})";
							break;
						case "record":
							validation = "z.record(z.string(), z.unknown())";
							break;
					}
					validation = addDescription(validation, schema.description, this.context.useDescribe);
				}
				break;
			case undefined:
			default:
				validation = "z.unknown()";
				validation = addDescription(validation, schema.description, this.context.useDescribe);
		}

		const result = wrapNullable(validation, nullable);

		// Store in cache if cacheable
		if (isCacheable) {
			const cacheKey = JSON.stringify({ schema, type: this.context.schemaType, mode: this.context.mode });
			this.schemaCache.set(cacheKey, result);
		}

		return result;
	}

	/**
	 * Generate inline object shape for use with .extend()
	 * Returns just the shape object literal: { prop1: z.string(), prop2: z.number() }
	 *
	 * This method is specifically for allOf compositions where we need to pass
	 * the shape directly to .extend() instead of using z.object({...}).shape.
	 * This avoids the .nullable().shape bug when inline objects have nullable: true.
	 *
	 * According to Zod docs (https://zod.dev/api?id=extend):
	 * - .extend() accepts an object of shape definitions
	 * - e.g., baseSchema.extend({ prop: z.string() })
	 */
	generateInlineObjectShape(schema: OpenAPISchema, currentSchema?: string): string {
		const required = new Set(schema.required || []);
		const properties: string[] = [];

		if (schema.properties) {
			for (const [propName, propSchema] of Object.entries(schema.properties)) {
				// Skip properties based on readOnly/writeOnly
				if (!this.shouldIncludeProperty(propSchema)) {
					continue;
				}

				const isRequired = required.has(propName);
				const zodSchema = this.generatePropertySchema(propSchema, currentSchema);

				// Quote property name if it contains special characters
				const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
				const quotedPropName = validIdentifier.test(propName) ? propName : `"${propName}"`;

				let propertyDef = `${quotedPropName}: ${zodSchema}`;
				if (!isRequired) {
					propertyDef += ".optional()";
				}

				properties.push(propertyDef);
			}
		}

		// Return the shape as an object literal
		if (properties.length === 0) {
			return "{}";
		}

		return `{\n${properties.map(p => `\t${p}`).join(",\n")}\n}`;
	}
}
