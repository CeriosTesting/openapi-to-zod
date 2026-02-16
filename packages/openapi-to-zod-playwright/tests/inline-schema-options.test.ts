import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

/**
 * Tests for all inline schema generation options.
 * Verifies that options are correctly passed to both request and response inline schemas.
 */
describe("Inline Schema Options", () => {
	const fixtureFile = TestUtils.getFixturePath("inline-schema-options-api.yaml");

	describe("defaultNullable option", () => {
		describe("when defaultNullable is false (default)", () => {
			it("should NOT add .nullable() to request inline schema properties", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					defaultNullable: false,
				});

				const schemasContent = generator.generateSchemasString();

				// Properties should be optional but NOT nullable
				expect(schemasContent).toContain("tenantId: z.uuid().optional()");
				expect(schemasContent).not.toContain("tenantId: z.uuid().nullable().optional()");
			});

			it("should NOT add .nullable() to response inline schema properties", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					defaultNullable: false,
				});

				const schemasContent = generator.generateSchemasString();

				// Response schema properties should be optional but NOT nullable
				expect(schemasContent).toContain("createdAt: z.iso.datetime().optional()");
				expect(schemasContent).not.toContain("createdAt: z.iso.datetime().nullable().optional()");
			});
		});

		describe("when defaultNullable is true", () => {
			it("should add .nullable() to request inline schema properties", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					defaultNullable: true,
				});

				const schemasContent = generator.generateSchemasString();

				// Properties should be nullable AND optional
				expect(schemasContent).toContain("tenantId: z.uuid().nullable().optional()");
			});

			it("should add .nullable() to response inline schema properties", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					defaultNullable: true,
				});

				const schemasContent = generator.generateSchemasString();

				// Response schema properties should be nullable AND optional
				expect(schemasContent).toContain("createdAt: z.iso.datetime().nullable().optional()");
			});

			it("should add .nullable() to both request and response inline schemas", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					defaultNullable: true,
				});

				const schemasContent = generator.generateSchemasString();

				// Request schema (createItem)
				expect(schemasContent).toContain("tenantId: z.uuid().nullable().optional()");
				expect(schemasContent).toContain("description: z.string().nullable().optional()");

				// Response schema (createItem 201 response)
				expect(schemasContent).toContain("createdAt: z.iso.datetime().nullable().optional()");
			});
		});
	});

	describe("emptyObjectBehavior option", () => {
		describe("when emptyObjectBehavior is 'loose' (default)", () => {
			it("should use z.looseObject({}) for empty objects in request inline schemas", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					emptyObjectBehavior: "loose",
				});

				const schemasContent = generator.generateSchemasString();

				// Empty object (metadata) should use looseObject (allows extra properties)
				expect(schemasContent).toMatch(/metadata:\s*z\.looseObject\(\{\}\)/);
				expect(schemasContent).not.toMatch(/metadata:\s*z\.strictObject\(\{\}\)/);
			});

			it("should use z.looseObject({}) for empty objects in response inline schemas", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					emptyObjectBehavior: "loose",
				});

				const schemasContent = generator.generateSchemasString();

				// Empty object (settings) should use looseObject (allows extra properties)
				expect(schemasContent).toMatch(/settings:\s*z\.looseObject\(\{\}\)/);
				expect(schemasContent).not.toMatch(/settings:\s*z\.strictObject\(\{\}\)/);
			});
		});

		describe("when emptyObjectBehavior is 'strict'", () => {
			it("should use z.strictObject({}) for empty objects in request inline schemas", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					emptyObjectBehavior: "strict",
				});

				const schemasContent = generator.generateSchemasString();

				// Empty object (metadata) should use strict object
				expect(schemasContent).toMatch(/metadata:\s*z\.strictObject\(\{\}\)/);
			});

			it("should use z.strictObject({}) for empty objects in response inline schemas", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					emptyObjectBehavior: "strict",
				});

				const schemasContent = generator.generateSchemasString();

				// Empty object (settings) should use strict object
				expect(schemasContent).toMatch(/settings:\s*z\.strictObject\(\{\}\)/);
			});
		});

		describe("when emptyObjectBehavior is 'record'", () => {
			it("should use z.record() for empty objects in request inline schemas", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					emptyObjectBehavior: "record",
				});

				const schemasContent = generator.generateSchemasString();

				// Empty object (metadata) should use record
				expect(schemasContent).toMatch(/metadata:\s*z\.record\(/);
			});

			it("should use z.record() for empty objects in response inline schemas", () => {
				const generator = new OpenApiPlaywrightGenerator({
					input: fixtureFile,
					outputTypes: "output.ts",
					outputClient: "client.ts",
					emptyObjectBehavior: "record",
				});

				const schemasContent = generator.generateSchemasString();

				// Empty object (settings) should use record
				expect(schemasContent).toMatch(/settings:\s*z\.record\(/);
			});
		});
	});

	describe("mode option", () => {
		it("should apply 'strict' mode to inline schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				mode: "strict",
			});

			const schemasContent = generator.generateSchemasString();

			// In strict mode, objects use strictObject
			expect(schemasContent).toContain("z.strictObject({");
		});

		it("should apply 'loose' mode to inline schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				mode: "loose",
			});

			const schemasContent = generator.generateSchemasString();

			// In loose mode, objects use looseObject
			expect(schemasContent).toContain("z.looseObject({");
		});

		it("should apply 'normal' mode to inline schemas (default)", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				mode: "normal",
			});

			const schemasContent = generator.generateSchemasString();

			// In normal mode, non-empty objects use regular z.object
			expect(schemasContent).toContain("z.object({");
			expect(schemasContent).not.toContain("z.strictObject({");
			// Note: Empty objects still use emptyObjectBehavior (defaults to 'loose' -> z.looseObject)
			// Only non-empty objects are affected by mode
		});
	});

	describe("prefix and suffix options", () => {
		it("should apply prefix to inline schema names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "Api",
			});

			const schemasContent = generator.generateSchemasString();

			// Check that inline schemas have the prefix
			// The referenced schema (PrefixedUser) should have prefix
			expect(schemasContent).toContain("apiPrefixedUserSchema");
		});

		it("should apply suffix to inline schema names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				suffix: "Dto",
			});

			const schemasContent = generator.generateSchemasString();

			// Check that referenced schema has the suffix
			expect(schemasContent).toContain("prefixedUserDtoSchema");
		});

		it("should apply both prefix and suffix to schema names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				prefix: "Api",
				suffix: "Dto",
			});

			const schemasContent = generator.generateSchemasString();

			// Check that referenced schema has both prefix and suffix
			expect(schemasContent).toContain("apiPrefixedUserDtoSchema");
		});
	});

	describe("stripSchemaPrefix option", () => {
		it("should strip prefix from schema names when stripSchemaPrefix is set", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				stripSchemaPrefix: "Prefixed",
			});

			const schemasContent = generator.generateSchemasString();

			// PrefixedUser should become userSchema
			expect(schemasContent).toContain("userSchema");
			expect(schemasContent).not.toContain("prefixedUserSchema");
		});

		it("should not strip prefix when stripSchemaPrefix is not set", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const schemasContent = generator.generateSchemasString();

			// PrefixedUser should remain as prefixedUserSchema
			expect(schemasContent).toContain("prefixedUserSchema");
		});
	});

	describe("includeDescriptions option", () => {
		it("should include JSDoc comments when includeDescriptions is true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				includeDescriptions: true,
				useDescribe: false,
			});

			const schemasContent = generator.generateSchemasString();

			// Should have JSDoc comments for properties with descriptions
			expect(schemasContent).toContain("/**");
			expect(schemasContent).toContain("*/");
		});

		it("should not include JSDoc comments when includeDescriptions is false", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				includeDescriptions: false,
				useDescribe: false,
			});

			const schemasContent = generator.generateSchemasString();

			// Should NOT have JSDoc comments for property descriptions
			expect(schemasContent).not.toMatch(/\/\*\*\s*\n?\s*\*?\s*The name of the item/);
			expect(schemasContent).not.toMatch(/\/\*\*\s*\n?\s*\*?\s*Additional metadata/);
			expect(schemasContent).not.toMatch(/\/\*\*\s*\n?\s*\*?\s*A detailed description/);
		});

		it("should have fewer JSDoc comments when includeDescriptions is false vs true", () => {
			const generatorWithDescriptions = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				includeDescriptions: true,
				useDescribe: false,
			});

			const generatorWithoutDescriptions = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				includeDescriptions: false,
				useDescribe: false,
			});

			const withDescriptions = generatorWithDescriptions.generateSchemasString();
			const withoutDescriptions = generatorWithoutDescriptions.generateSchemasString();

			const jsdocMatchesWithDescriptions = withDescriptions.match(/\/\*\*[\s\S]*?\*\//g) || [];
			const jsdocMatchesWithoutDescriptions = withoutDescriptions.match(/\/\*\*[\s\S]*?\*\//g) || [];

			// With includeDescriptions: true, there should be more JSDoc comments
			expect(jsdocMatchesWithDescriptions.length).toBeGreaterThan(jsdocMatchesWithoutDescriptions.length);
		});
	});

	describe("useDescribe option", () => {
		it("should use .describe() when useDescribe is true", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				includeDescriptions: true,
				useDescribe: true,
			});

			const schemasContent = generator.generateSchemasString();

			// Should have .describe() calls for properties with descriptions
			expect(schemasContent).toContain('.describe("');
		});

		it("should not use .describe() when useDescribe is false", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				includeDescriptions: true,
				useDescribe: false,
			});

			const schemasContent = generator.generateSchemasString();

			// Should NOT have .describe() calls (uses JSDoc instead)
			expect(schemasContent).not.toContain('.describe("');
		});
	});

	describe("combined options", () => {
		it("should apply defaultNullable and emptyObjectBehavior together for request schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				defaultNullable: true,
				emptyObjectBehavior: "strict",
			});

			const schemasContent = generator.generateSchemasString();

			// Both options should be applied
			expect(schemasContent).toContain("tenantId: z.uuid().nullable().optional()");
			expect(schemasContent).toMatch(/metadata:\s*z\.strictObject\(\{\}\)/);
		});

		it("should apply defaultNullable and emptyObjectBehavior together for response schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				defaultNullable: true,
				emptyObjectBehavior: "strict",
			});

			const schemasContent = generator.generateSchemasString();

			// Both options should be applied to response schemas
			expect(schemasContent).toContain("createdAt: z.iso.datetime().nullable().optional()");
			expect(schemasContent).toMatch(/settings:\s*z\.strictObject\(\{\}\)/);
		});

		it("should apply all options together", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				outputClient: "client.ts",
				defaultNullable: true,
				emptyObjectBehavior: "record",
				mode: "strict",
				prefix: "Api",
				suffix: "Dto",
				stripSchemaPrefix: "Prefixed",
				includeDescriptions: true,
				useDescribe: true,
			});

			const schemasContent = generator.generateSchemasString();

			// Verify multiple options are applied
			// stripSchemaPrefix: PrefixedUser -> User, then prefix/suffix: ApiUserDto
			expect(schemasContent).toContain("apiUserDtoSchema");
			// defaultNullable
			expect(schemasContent).toContain(".nullable()");
			// emptyObjectBehavior: record
			expect(schemasContent).toMatch(/z\.record\(/);
			// mode: strict
			expect(schemasContent).toContain("z.strictObject({");
			// useDescribe
			expect(schemasContent).toContain('.describe("');
		});
	});
});
