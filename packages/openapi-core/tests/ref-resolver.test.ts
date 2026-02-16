import { describe, expect, it } from "vitest";

import type { OpenAPISpec } from "../src/types";
import {
	mergeParameters,
	resolveParameterRef,
	resolveRef,
	resolveRequestBodyRef,
	resolveResponseRef,
} from "../src/utils/ref-resolver";

describe("ref-resolver", () => {
	describe("resolveRef", () => {
		it("should return the object as-is if no $ref", () => {
			const spec: OpenAPISpec = { components: { schemas: {} } };
			const obj = { type: "string" };
			expect(resolveRef(obj, spec)).toBe(obj);
		});

		it("should resolve schema $ref", () => {
			const spec: OpenAPISpec = {
				components: {
					schemas: {
						User: { type: "object", properties: { name: { type: "string" } } },
					},
				},
			};
			const ref = { $ref: "#/components/schemas/User" };
			const resolved = resolveRef(ref, spec);
			expect(resolved).toEqual({ type: "object", properties: { name: { type: "string" } } });
		});

		it("should resolve parameter $ref", () => {
			const spec: OpenAPISpec = {
				components: {
					parameters: {
						UserId: { name: "userId", in: "path", required: true, schema: { type: "string" } },
					},
				},
			};
			const ref = { $ref: "#/components/parameters/UserId" };
			const resolved = resolveRef(ref, spec);
			expect(resolved).toEqual({ name: "userId", in: "path", required: true, schema: { type: "string" } });
		});

		it("should resolve requestBody $ref", () => {
			const spec: OpenAPISpec = {
				components: {
					requestBodies: {
						UserInput: { content: { "application/json": { schema: { type: "object" } } } },
					},
				},
			};
			const ref = { $ref: "#/components/requestBodies/UserInput" };
			const resolved = resolveRef(ref, spec);
			expect(resolved).toEqual({ content: { "application/json": { schema: { type: "object" } } } });
		});

		it("should resolve response $ref", () => {
			const spec: OpenAPISpec = {
				components: {
					responses: {
						NotFound: { description: "Not found" },
					},
				},
			};
			const ref = { $ref: "#/components/responses/NotFound" };
			const resolved = resolveRef(ref, spec);
			expect(resolved).toEqual({ description: "Not found" });
		});

		it("should handle nested $refs", () => {
			const spec: OpenAPISpec = {
				components: {
					schemas: {
						Alias: { $ref: "#/components/schemas/Actual" },
						Actual: { type: "string" },
					},
				},
			};
			const ref = { $ref: "#/components/schemas/Alias" };
			const resolved = resolveRef(ref, spec);
			expect(resolved).toEqual({ type: "string" });
		});

		it("should return original object if $ref cannot be resolved", () => {
			const spec: OpenAPISpec = { components: { schemas: {} } };
			const ref = { $ref: "#/components/schemas/NonExistent" };
			const resolved = resolveRef(ref, spec);
			expect(resolved).toBe(ref);
		});

		it("should handle max depth to prevent infinite loops", () => {
			const spec: OpenAPISpec = {
				components: {
					schemas: {
						A: { $ref: "#/components/schemas/B" },
						B: { $ref: "#/components/schemas/A" },
					},
				},
			};
			const ref = { $ref: "#/components/schemas/A" };
			// Should not throw, just stop at max depth
			const resolved = resolveRef(ref, spec, 2);
			expect(resolved).toBeDefined();
		});

		it("should return null/undefined as-is", () => {
			const spec: OpenAPISpec = { components: { schemas: {} } };
			expect(resolveRef(null, spec)).toBeNull();
			expect(resolveRef(undefined, spec)).toBeUndefined();
		});
	});

	describe("resolveParameterRef", () => {
		it("should resolve parameter reference", () => {
			const spec: OpenAPISpec = {
				components: {
					parameters: {
						PageParam: { name: "page", in: "query", schema: { type: "integer" } },
					},
				},
			};
			const ref = { $ref: "#/components/parameters/PageParam" };
			const resolved = resolveParameterRef(ref, spec);
			expect(resolved.name).toBe("page");
			expect(resolved.in).toBe("query");
		});
	});

	describe("resolveRequestBodyRef", () => {
		it("should resolve request body reference", () => {
			const spec: OpenAPISpec = {
				components: {
					requestBodies: {
						CreateUser: { required: true, content: {} },
					},
				},
			};
			const ref = { $ref: "#/components/requestBodies/CreateUser" };
			const resolved = resolveRequestBodyRef(ref, spec);
			expect(resolved.required).toBe(true);
		});
	});

	describe("resolveResponseRef", () => {
		it("should resolve response reference", () => {
			const spec: OpenAPISpec = {
				components: {
					responses: {
						Success: { description: "Success response" },
					},
				},
			};
			const ref = { $ref: "#/components/responses/Success" };
			const resolved = resolveResponseRef(ref, spec);
			expect(resolved.description).toBe("Success response");
		});
	});

	describe("mergeParameters", () => {
		const spec: OpenAPISpec = {
			components: {
				parameters: {
					CommonParam: { name: "common", in: "query", schema: { type: "string" } },
				},
			},
		};

		it("should return empty array when both inputs are undefined", () => {
			const merged = mergeParameters(undefined, undefined, spec);
			expect(merged).toEqual([]);
		});

		it("should return path params when operation params are undefined", () => {
			const pathParams = [{ name: "id", in: "path", schema: { type: "string" } }];
			const merged = mergeParameters(pathParams, undefined, spec);
			expect(merged).toHaveLength(1);
			expect(merged[0].name).toBe("id");
		});

		it("should return operation params when path params are undefined", () => {
			const opParams = [{ name: "filter", in: "query", schema: { type: "string" } }];
			const merged = mergeParameters(undefined, opParams, spec);
			expect(merged).toHaveLength(1);
			expect(merged[0].name).toBe("filter");
		});

		it("should merge path and operation params", () => {
			const pathParams = [{ name: "id", in: "path", schema: { type: "string" } }];
			const opParams = [{ name: "filter", in: "query", schema: { type: "string" } }];
			const merged = mergeParameters(pathParams, opParams, spec);
			expect(merged).toHaveLength(2);
		});

		it("should override path params with operation params of same name and location", () => {
			const pathParams = [{ name: "id", in: "path", schema: { type: "string" }, description: "Path level" }];
			const opParams = [{ name: "id", in: "path", schema: { type: "integer" }, description: "Operation level" }];
			const merged = mergeParameters(pathParams, opParams, spec);
			expect(merged).toHaveLength(1);
			expect(merged[0].description).toBe("Operation level");
			expect(merged[0].schema.type).toBe("integer");
		});

		it("should not override if location differs", () => {
			const pathParams = [{ name: "id", in: "path", schema: { type: "string" } }];
			const opParams = [{ name: "id", in: "query", schema: { type: "string" } }];
			const merged = mergeParameters(pathParams, opParams, spec);
			expect(merged).toHaveLength(2);
		});

		it("should resolve $ref parameters", () => {
			const pathParams = [{ $ref: "#/components/parameters/CommonParam" }];
			const merged = mergeParameters(pathParams, undefined, spec);
			expect(merged).toHaveLength(1);
			expect(merged[0].name).toBe("common");
		});
	});
});
