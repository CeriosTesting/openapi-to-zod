import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

describe("Query Parameter Types in Service Methods", () => {
	const schemaPath = resolve(__dirname, "fixtures/query-params-validation-api.yaml");

	it("should generate service methods with typed query parameters", () => {
		const generator = new OpenApiPlaywrightGenerator({ input: schemaPath, output: "test.ts" });
		const output = generator.generateServiceString();

		// Should import query parameter types (not schemas)
		expect(output).toContain("SearchUsersQueryParams");

		// Should use typed params in method signature
		expect(output).toContain("params?: SearchUsersQueryParams");
	});

	it("should not add runtime validation for query parameters", () => {
		const generator = new OpenApiPlaywrightGenerator({ input: schemaPath, output: "test.ts" });
		const output = generator.generateServiceString();

		// Should NOT validate query params (compile-time only)
		expect(output).not.toContain("// Validate query parameters");
		expect(output).not.toContain("searchUsersQueryParamsSchema.parse");
	});

	it("should not add params for operations without query parameters", () => {
		const generator = new OpenApiPlaywrightGenerator({ input: schemaPath, output: "test.ts" });
		const output = generator.generateServiceString();

		// Simple endpoint without query params should not have params in signature
		const simpleMethod = output.match(/async getApiSimple\([^)]*\)/);
		expect(simpleMethod).toBeTruthy();
		if (simpleMethod) {
			expect(simpleMethod[0]).not.toContain("params");
		}
	});

	it("should handle operations with both path and query parameters", () => {
		const generator = new OpenApiPlaywrightGenerator({ input: schemaPath, output: "test.ts" });
		const output = generator.generateServiceString();

		// GetPostQueryParams type should be imported
		expect(output).toContain("GetPostQueryParams");

		// Method should have both path param and params
		expect(output).toContain("postId: string");
		expect(output).toContain("params?: GetPostQueryParams");
	});

	it("should generate valid TypeScript code", () => {
		const generator = new OpenApiPlaywrightGenerator({ input: schemaPath, output: "test.ts" });
		const output = generator.generateServiceString();

		// Basic validation of service class structure (class name derived from filename)
		expect(output).toContain("export class TestService");
		expect(output).toContain("constructor(private");
		expect(output).toContain("readonly client: TestClient");
	});

	it("should include query parameter types (not schemas)", () => {
		const generator = new OpenApiPlaywrightGenerator({ input: schemaPath, output: "test.ts" });
		const output = generator.generateSchemasString();

		// Check that output includes query param types
		expect(output).toContain("SearchUsersQueryParams");
		expect(output).toContain("GetPostQueryParams");

		// Should include type definitions or imports (not schema variables for service methods)
		// In service methods, we use types not schemas for validation
		expect(output).toContain("export type SearchUsersQueryParams");
	});

	it("should use correct naming convention for types", () => {
		const generator = new OpenApiPlaywrightGenerator({ input: schemaPath, output: "test.ts" });
		const output = generator.generateServiceString();

		// Type names should follow {OperationId}QueryParams pattern
		expect(output).toContain("SearchUsersQueryParams");
		expect(output).toContain("GetPostQueryParams");
	});
});
