import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("Inline Request Schema Generation", () => {
	describe("basic inline request schema generation", () => {
		it("should generate named schema for inline object request body", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();
			const serviceOutput = generator.generateServiceString();

			// Should generate a named schema for the inline request body
			expect(schemasOutput).toContain("postInlineRequestSchema");
			expect(schemasOutput).toContain("export type PostInlineRequest");

			// Service should use the named type for the data parameter
			expect(serviceOutput).toContain("data: PostInlineRequest");
		});

		it("should use method name + Request pattern for schema names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			// Schema names should follow {MethodName}Request pattern
			expect(schemasOutput).toMatch(/\w+RequestSchema/);
		});
	});

	describe("schema and type ordering", () => {
		it("should place type immediately after its schema (not grouped at end)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			// Find the inline request schemas section
			const inlineSectionMatch = schemasOutput.match(
				/\/\/ Inline Request Schemas[\s\S]*?(?=\/\/ Inline Response Schemas|$)/
			);

			if (inlineSectionMatch) {
				const inlineSection = inlineSectionMatch[0];

				// Each schema should be immediately followed by its type
				const schemaTypePattern = /export const (\w+Schema) = [^;]+;\s*export type (\w+) = z\.infer<typeof \1>;/g;
				const matches = [...inlineSection.matchAll(schemaTypePattern)];

				// Should have at least one schema/type pair
				expect(matches.length).toBeGreaterThan(0);
			}
		});

		it("should not have separate types section header", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			// Should NOT have a separate "Inline Request Types" section
			expect(schemasOutput).not.toContain("// Inline Request Types");
		});
	});

	describe("service integration", () => {
		it("should use named inline schema type for data parameter", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const serviceOutput = generator.generateServiceString();

			// Should use the named type, not RequestBody
			expect(serviceOutput).toMatch(/data: \w+Request\b/);
		});

		it("should validate inline request body when validateServiceRequest is true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
			});

			const serviceOutput = generator.generateServiceString();

			// Should validate with the named schema
			expect(serviceOutput).toMatch(/\w+RequestSchema\.parseAsync/);
		});
	});

	describe("with prefix/suffix options", () => {
		it("should apply prefix to inline request schema names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "api",
			});

			const schemasOutput = generator.generateSchemasString();

			// Schema variable should have prefix
			expect(schemasOutput).toContain("apiPostInlineRequestSchema");
			// Type name should NOT have prefix
			expect(schemasOutput).toContain("export type PostInlineRequest");
		});

		it("should apply suffix to inline request schema names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				suffix: "Dto",
			});

			const schemasOutput = generator.generateSchemasString();

			// Schema variable should have suffix
			expect(schemasOutput).toContain("postInlineRequestDtoSchema");
		});
	});

	describe("required vs optional request body", () => {
		it("should mark data as required when request body is required", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const serviceOutput = generator.generateServiceString();

			// Required request body should have non-optional data
			// Look for method with required body
			expect(serviceOutput).toMatch(/data: \w+Request\b/);
		});

		it("should mark data as optional when request body is optional", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("optional-inline-request-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const serviceOutput = generator.generateServiceString();

			// Optional request body should have optional data
			expect(serviceOutput).toMatch(/data\?: \w+Request\b/);
		});
	});

	describe("readOnly property filtering", () => {
		it("should exclude readOnly properties from request schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("readonly-inline-request-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			// Find the inline request schema section
			const requestSectionMatch = schemasOutput.match(
				/\/\/ Inline Request Schemas[\s\S]*?(?=\/\/ Inline Response Schemas|$)/
			);

			if (requestSectionMatch) {
				const requestSection = requestSectionMatch[0];
				// readOnly properties like 'id' and 'createdAt' should be excluded from request schemas
				expect(requestSection).not.toMatch(/\bid:/);
				expect(requestSection).not.toMatch(/\bcreatedAt:/);
				// Non-readOnly properties should be included
				expect(requestSection).toContain("name:");
				expect(requestSection).toContain("email:");
			}
		});
	});

	describe("both request and response inline schemas", () => {
		it("should generate both inline request and response schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			// Should have both sections
			expect(schemasOutput).toContain("// Inline Request Schemas");
			expect(schemasOutput).toContain("// Inline Response Schemas");

			// Should have both request and response schemas
			expect(schemasOutput).toMatch(/export const \w+RequestSchema/);
			expect(schemasOutput).toMatch(/export const \w+ResponseSchema/);
		});

		it("should generate request schemas before response schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-request-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const schemasOutput = generator.generateSchemasString();

			const requestSectionIndex = schemasOutput.indexOf("// Inline Request Schemas");
			const responseSectionIndex = schemasOutput.indexOf("// Inline Response Schemas");

			// Request schemas should come before response schemas
			if (requestSectionIndex !== -1 && responseSectionIndex !== -1) {
				expect(requestSectionIndex).toBeLessThan(responseSectionIndex);
			}
		});
	});
});
