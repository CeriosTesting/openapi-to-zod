import { describe, expect, it } from "vitest";

import type { OpenAPISchema, OpenAPISpec } from "../src/types";
import {
	analyzeSchemaUsage,
	buildDependencyGraph,
	classifyEnumType,
	detectCircularReferences,
	expandTransitiveReferences,
	extractSchemaRefs,
	getSchema,
	getSchemaNames,
	hasReadOnlyProperties,
	hasWriteOnlyProperties,
	isCircularThroughAlias,
	resolveDiscriminatorMapping,
	resolveSchemaAlias,
	topologicalSortSchemas,
	validateDiscriminatorProperty,
} from "../src/utils/schema-traversal";

describe("Schema Traversal Utilities", () => {
	describe("extractSchemaRefs", () => {
		it("should extract direct $ref", () => {
			const refs = new Set<string>();
			extractSchemaRefs({ $ref: "#/components/schemas/User" }, refs);
			expect(refs).toContain("User");
		});

		it("should extract refs from allOf", () => {
			const refs = new Set<string>();
			extractSchemaRefs(
				{
					allOf: [{ $ref: "#/components/schemas/Base" }, { $ref: "#/components/schemas/Extended" }],
				},
				refs
			);
			expect(refs).toContain("Base");
			expect(refs).toContain("Extended");
		});

		it("should extract refs from oneOf", () => {
			const refs = new Set<string>();
			extractSchemaRefs(
				{
					oneOf: [{ $ref: "#/components/schemas/Cat" }, { $ref: "#/components/schemas/Dog" }],
				},
				refs
			);
			expect(refs).toContain("Cat");
			expect(refs).toContain("Dog");
		});

		it("should extract refs from anyOf", () => {
			const refs = new Set<string>();
			extractSchemaRefs(
				{
					anyOf: [{ $ref: "#/components/schemas/Option1" }, { $ref: "#/components/schemas/Option2" }],
				},
				refs
			);
			expect(refs).toContain("Option1");
			expect(refs).toContain("Option2");
		});

		it("should extract refs from items", () => {
			const refs = new Set<string>();
			extractSchemaRefs(
				{
					type: "array",
					items: { $ref: "#/components/schemas/Item" },
				},
				refs
			);
			expect(refs).toContain("Item");
		});

		it("should extract refs from properties", () => {
			const refs = new Set<string>();
			extractSchemaRefs(
				{
					type: "object",
					properties: {
						user: { $ref: "#/components/schemas/User" },
						role: { $ref: "#/components/schemas/Role" },
					},
				},
				refs
			);
			expect(refs).toContain("User");
			expect(refs).toContain("Role");
		});

		it("should extract refs from prefixItems", () => {
			const refs = new Set<string>();
			extractSchemaRefs(
				{
					type: "array",
					prefixItems: [{ $ref: "#/components/schemas/First" }, { $ref: "#/components/schemas/Second" }],
				},
				refs
			);
			expect(refs).toContain("First");
			expect(refs).toContain("Second");
		});

		it("should extract refs from additionalProperties", () => {
			const refs = new Set<string>();
			extractSchemaRefs(
				{
					type: "object",
					additionalProperties: { $ref: "#/components/schemas/Value" },
				},
				refs
			);
			expect(refs).toContain("Value");
		});

		it("should extract refs from not", () => {
			const refs = new Set<string>();
			extractSchemaRefs(
				{
					not: { $ref: "#/components/schemas/Excluded" },
				},
				refs
			);
			expect(refs).toContain("Excluded");
		});

		it("should extract refs from if/then/else", () => {
			const refs = new Set<string>();
			const schema: OpenAPISchema = {
				if: { $ref: "#/components/schemas/Condition" },
				// oxlint-disable-next-line unicorn/no-thenable
				then: { $ref: "#/components/schemas/ThenSchema" },
				else: { $ref: "#/components/schemas/ElseSchema" },
			};
			extractSchemaRefs(schema, refs);
			expect(refs).toContain("Condition");
			expect(refs).toContain("ThenSchema");
			expect(refs).toContain("ElseSchema");
		});

		it("should handle undefined schema", () => {
			const refs = new Set<string>();
			extractSchemaRefs(undefined, refs);
			expect(refs.size).toBe(0);
		});

		it("should handle deeply nested refs", () => {
			const refs = new Set<string>();
			extractSchemaRefs(
				{
					type: "object",
					properties: {
						nested: {
							type: "object",
							properties: {
								deep: { $ref: "#/components/schemas/Deep" },
							},
						},
					},
				},
				refs
			);
			expect(refs).toContain("Deep");
		});
	});

	describe("expandTransitiveReferences", () => {
		it("should expand direct references", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						A: { $ref: "#/components/schemas/B" },
						B: { type: "string" },
					},
				},
			};

			const schemas = new Set(["A"]);
			expandTransitiveReferences(schemas, spec);
			expect(schemas).toContain("A");
			expect(schemas).toContain("B");
		});

		it("should expand nested references", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						A: { $ref: "#/components/schemas/B" },
						B: { $ref: "#/components/schemas/C" },
						C: { type: "string" },
					},
				},
			};

			const schemas = new Set(["A"]);
			expandTransitiveReferences(schemas, spec);
			expect(schemas).toContain("A");
			expect(schemas).toContain("B");
			expect(schemas).toContain("C");
		});

		it("should handle circular references without infinite loop", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						A: {
							type: "object",
							properties: {
								b: { $ref: "#/components/schemas/B" },
							},
						},
						B: {
							type: "object",
							properties: {
								a: { $ref: "#/components/schemas/A" },
							},
						},
					},
				},
			};

			const schemas = new Set(["A"]);
			expandTransitiveReferences(schemas, spec);
			expect(schemas).toContain("A");
			expect(schemas).toContain("B");
		});
	});

	describe("resolveSchemaAlias", () => {
		it("should resolve simple allOf alias", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						UserAlias: {
							allOf: [{ $ref: "#/components/schemas/User" }],
						},
						User: { type: "object" },
					},
				},
			};

			expect(resolveSchemaAlias("UserAlias", spec)).toBe("User");
		});

		it("should return original name for non-alias", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						User: { type: "object" },
					},
				},
			};

			expect(resolveSchemaAlias("User", spec)).toBe("User");
		});

		it("should return original name for allOf with multiple items", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Combined: {
							allOf: [{ $ref: "#/components/schemas/A" }, { $ref: "#/components/schemas/B" }],
						},
						A: { type: "object" },
						B: { type: "object" },
					},
				},
			};

			expect(resolveSchemaAlias("Combined", spec)).toBe("Combined");
		});
	});

	describe("detectCircularReferences", () => {
		it("should detect simple circular reference", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Node: {
							type: "object",
							properties: {
								child: { $ref: "#/components/schemas/Node" },
							},
						},
					},
				},
			};

			const circular = detectCircularReferences(spec);
			expect(circular.has("Node")).toBe(true);
		});

		it("should detect indirect circular reference", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						A: {
							type: "object",
							properties: {
								b: { $ref: "#/components/schemas/B" },
							},
						},
						B: {
							type: "object",
							properties: {
								a: { $ref: "#/components/schemas/A" },
							},
						},
					},
				},
			};

			const circular = detectCircularReferences(spec);
			expect(circular.has("A") || circular.has("B")).toBe(true);
		});

		it("should not detect false positives", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						A: {
							type: "object",
							properties: {
								b: { $ref: "#/components/schemas/B" },
							},
						},
						B: { type: "string" },
					},
				},
			};

			const circular = detectCircularReferences(spec);
			expect(circular.size).toBe(0);
		});
	});

	describe("isCircularThroughAlias", () => {
		it("should detect circular through alias chain", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Alias1: { allOf: [{ $ref: "#/components/schemas/Alias2" }] },
						Alias2: { allOf: [{ $ref: "#/components/schemas/Target" }] },
						Target: { type: "object" },
					},
				},
			};

			expect(isCircularThroughAlias("Alias1", "Target", spec)).toBe(true);
		});

		it("should return false for non-circular", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						A: { type: "object" },
						B: { type: "string" },
					},
				},
			};

			expect(isCircularThroughAlias("A", "B", spec)).toBe(false);
		});
	});

	describe("buildDependencyGraph", () => {
		it("should build graph with dependencies", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						User: {
							type: "object",
							properties: {
								role: { $ref: "#/components/schemas/Role" },
							},
						},
						Role: { type: "string" },
					},
				},
			};

			const graph = buildDependencyGraph(spec);
			expect(graph.get("User")?.has("Role")).toBe(true);
			expect(graph.get("Role")?.size).toBe(0);
		});

		it("should handle schemas with no dependencies", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Simple: { type: "string" },
					},
				},
			};

			const graph = buildDependencyGraph(spec);
			expect(graph.get("Simple")?.size).toBe(0);
		});
	});

	describe("topologicalSortSchemas", () => {
		it("should sort dependencies before dependents", () => {
			const deps = new Map<string, Set<string>>();
			deps.set("A", new Set(["B"]));
			deps.set("B", new Set(["C"]));
			deps.set("C", new Set());

			const sorted = topologicalSortSchemas(deps);
			expect(sorted.indexOf("C")).toBeLessThan(sorted.indexOf("B"));
			expect(sorted.indexOf("B")).toBeLessThan(sorted.indexOf("A"));
		});

		it("should handle circular schemas", () => {
			const deps = new Map<string, Set<string>>();
			deps.set("A", new Set(["B"]));
			deps.set("B", new Set(["A"]));
			deps.set("C", new Set());

			const circular = new Set(["A", "B"]);
			const sorted = topologicalSortSchemas(deps, circular);

			// C should come first (non-circular)
			expect(sorted[0]).toBe("C");
			// A and B should be at the end
			expect(sorted).toContain("A");
			expect(sorted).toContain("B");
		});

		it("should handle independent schemas", () => {
			const deps = new Map<string, Set<string>>();
			deps.set("A", new Set());
			deps.set("B", new Set());
			deps.set("C", new Set());

			const sorted = topologicalSortSchemas(deps);
			expect(sorted.length).toBe(3);
			expect(sorted).toContain("A");
			expect(sorted).toContain("B");
			expect(sorted).toContain("C");
		});
	});

	describe("hasReadOnlyProperties", () => {
		it("should detect readOnly at top level", () => {
			const schema: OpenAPISchema = { type: "string", readOnly: true };
			expect(hasReadOnlyProperties(schema)).toBe(true);
		});

		it("should detect readOnly in properties", () => {
			const schema: OpenAPISchema = {
				type: "object",
				properties: {
					id: { type: "string", readOnly: true },
				},
			};
			expect(hasReadOnlyProperties(schema)).toBe(true);
		});

		it("should detect readOnly in allOf", () => {
			const schema: OpenAPISchema = {
				allOf: [{ type: "object", readOnly: true }],
			};
			expect(hasReadOnlyProperties(schema)).toBe(true);
		});

		it("should detect readOnly in items", () => {
			const schema: OpenAPISchema = {
				type: "array",
				items: { type: "string", readOnly: true },
			};
			expect(hasReadOnlyProperties(schema)).toBe(true);
		});

		it("should return false for no readOnly", () => {
			const schema: OpenAPISchema = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
			};
			expect(hasReadOnlyProperties(schema)).toBe(false);
		});
	});

	describe("hasWriteOnlyProperties", () => {
		it("should detect writeOnly at top level", () => {
			const schema: OpenAPISchema = { type: "string", writeOnly: true };
			expect(hasWriteOnlyProperties(schema)).toBe(true);
		});

		it("should detect writeOnly in properties", () => {
			const schema: OpenAPISchema = {
				type: "object",
				properties: {
					password: { type: "string", writeOnly: true },
				},
			};
			expect(hasWriteOnlyProperties(schema)).toBe(true);
		});

		it("should return false for no writeOnly", () => {
			const schema: OpenAPISchema = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
			};
			expect(hasWriteOnlyProperties(schema)).toBe(false);
		});
	});

	describe("analyzeSchemaUsage", () => {
		it("should detect request-only schemas", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {
					"/users": {
						post: {
							requestBody: {
								content: {
									"application/json": {
										schema: { $ref: "#/components/schemas/CreateUser" },
									},
								},
							},
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/User" },
										},
									},
								},
							},
						},
					},
				},
				components: {
					schemas: {
						CreateUser: { type: "object" },
						User: { type: "object" },
					},
				},
			};

			const analysis = analyzeSchemaUsage(spec);
			expect(analysis.usageMap.get("CreateUser")).toBe("request");
			expect(analysis.usageMap.get("User")).toBe("response");
		});

		it("should detect schemas used in both contexts", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {
					"/users": {
						post: {
							requestBody: {
								content: {
									"application/json": {
										schema: { $ref: "#/components/schemas/User" },
									},
								},
							},
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/User" },
										},
									},
								},
							},
						},
					},
				},
				components: {
					schemas: {
						User: { type: "object" },
					},
				},
			};

			const analysis = analyzeSchemaUsage(spec);
			expect(analysis.usageMap.get("User")).toBe("both");
		});

		it("should mark circular schemas as both", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Node: {
							type: "object",
							properties: {
								child: { $ref: "#/components/schemas/Node" },
							},
						},
					},
				},
			};

			const analysis = analyzeSchemaUsage(spec);
			expect(analysis.circularSchemas.has("Node")).toBe(true);
			expect(analysis.usageMap.get("Node")).toBe("both");
		});

		it("should use readOnly/writeOnly as fallback", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						ResponseOnly: {
							type: "object",
							properties: {
								id: { type: "string", readOnly: true },
							},
						},
						RequestOnly: {
							type: "object",
							properties: {
								password: { type: "string", writeOnly: true },
							},
						},
					},
				},
			};

			const analysis = analyzeSchemaUsage(spec);
			expect(analysis.usageMap.get("ResponseOnly")).toBe("response");
			expect(analysis.usageMap.get("RequestOnly")).toBe("request");
		});
	});

	describe("resolveDiscriminatorMapping", () => {
		it("should resolve mapping to schema names", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Cat: { type: "object" },
						Dog: { type: "object" },
					},
				},
			};

			const discriminator = {
				propertyName: "petType",
				mapping: {
					cat: "#/components/schemas/Cat",
					dog: "#/components/schemas/Dog",
				},
			};

			const result = resolveDiscriminatorMapping(discriminator, spec);
			expect(result).toContainEqual(["cat", "Cat"]);
			expect(result).toContainEqual(["dog", "Dog"]);
		});

		it("should skip non-existent schemas", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Cat: { type: "object" },
					},
				},
			};

			const discriminator = {
				propertyName: "petType",
				mapping: {
					cat: "#/components/schemas/Cat",
					dog: "#/components/schemas/Dog", // doesn't exist
				},
			};

			const result = resolveDiscriminatorMapping(discriminator, spec);
			expect(result.length).toBe(1);
			expect(result[0]).toEqual(["cat", "Cat"]);
		});

		it("should return empty array for no mapping", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: { schemas: {} },
			};

			const discriminator = { propertyName: "type" };
			const result = resolveDiscriminatorMapping(discriminator, spec);
			expect(result).toEqual([]);
		});
	});

	describe("validateDiscriminatorProperty", () => {
		it("should return true when property is required in all schemas", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Cat: {
							type: "object",
							required: ["petType"],
							properties: {
								petType: { type: "string" },
							},
						},
						Dog: {
							type: "object",
							required: ["petType"],
							properties: {
								petType: { type: "string" },
							},
						},
					},
				},
			};

			expect(validateDiscriminatorProperty(["Cat", "Dog"], "petType", spec)).toBe(true);
		});

		it("should return false when property is not required", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Cat: {
							type: "object",
							properties: {
								petType: { type: "string" },
							},
						},
					},
				},
			};

			expect(validateDiscriminatorProperty(["Cat"], "petType", spec)).toBe(false);
		});

		it("should return false when property doesn't exist", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						Cat: {
							type: "object",
							required: ["petType"],
							properties: {},
						},
					},
				},
			};

			expect(validateDiscriminatorProperty(["Cat"], "petType", spec)).toBe(false);
		});
	});

	describe("classifyEnumType", () => {
		it("should classify all booleans", () => {
			expect(classifyEnumType([true, false])).toBe("boolean");
		});

		it("should classify all strings", () => {
			expect(classifyEnumType(["a", "b", "c"])).toBe("string");
		});

		it("should classify all numbers", () => {
			expect(classifyEnumType([1, 2, 3])).toBe("number");
		});

		it("should classify mixed types", () => {
			expect(classifyEnumType(["a", 1, true])).toBe("mixed");
		});

		it("should classify empty as mixed", () => {
			expect(classifyEnumType([])).toBe("mixed");
		});
	});

	describe("getSchemaNames", () => {
		it("should return all schema names", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						User: { type: "object" },
						Role: { type: "string" },
					},
				},
			};

			const names = getSchemaNames(spec);
			expect(names).toContain("User");
			expect(names).toContain("Role");
		});

		it("should return empty array for no schemas", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
			};

			expect(getSchemaNames(spec)).toEqual([]);
		});
	});

	describe("getSchema", () => {
		it("should return schema by name", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: {
					schemas: {
						User: { type: "object", description: "A user" },
					},
				},
			};

			const schema = getSchema(spec, "User");
			expect(schema?.type).toBe("object");
			expect(schema?.description).toBe("A user");
		});

		it("should return undefined for non-existent schema", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
				components: { schemas: {} },
			};

			expect(getSchema(spec, "NotFound")).toBeUndefined();
		});
	});
});
