import { readFileSync, unlinkSync, writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

import { TestUtils } from "./utils/test-utils";

/**
 * Enhanced tests for dependencies and dependentRequired features
 * Tests the unified conditional-validator implementation with enhanced features
 */
describe("Dependencies & DependentRequired - Enhanced Features", () => {
	const outputPath = TestUtils.getOutputPath("dependencies-enhanced.ts");

	describe("Current Implementation Works", () => {
		it("handles basic property dependencies correctly", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("dependencies.yaml"),
				outputTypes: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			// Verify the output was generated
			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("creditCardSchema");
			expect(output).toContain("superRefine");
			expect(output).toContain("securityCode");
			expect(output).toContain("billingZip");

			// Clear module cache and import fresh
			delete require.cache[require.resolve(outputPath)];
			const module = await import(`${outputPath}?t=${Date.now()}`);
			const creditCardSchema = module.creditCardSchema;

			// Valid: no credit card
			expect(() => creditCardSchema.parse({ name: "John" })).not.toThrow();

			// Valid: credit card with all dependencies
			expect(() =>
				creditCardSchema.parse({
					name: "John",
					creditCard: "1234",
					securityCode: "123",
					billingZip: "12345",
				})
			).not.toThrow();

			// Invalid: credit card without dependencies
			try {
				creditCardSchema.parse({
					name: "John",
					creditCard: "1234",
				});
				expect.fail("Should have thrown");
			} catch (error: any) {
				// Currently throws with message about missing properties
				expect(error.message).toContain("securityCode");
				expect(error.message).toContain("billingZip");
			}
		});

		it("handles schema dependencies correctly", async () => {
			const schemaOutputPath = TestUtils.getOutputPath("schema-dependencies-enhanced.ts");
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("schema-dependencies.yaml"),
				outputTypes: schemaOutputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			// Verify output
			const output = readFileSync(schemaOutputPath, "utf-8");
			expect(output).toContain("paymentWithAddressSchema");
			expect(output).toContain("refine");

			// Clear module cache
			delete require.cache[require.resolve(schemaOutputPath)];
			const module = await import(`${schemaOutputPath}?t=${Date.now()}`);
			const paymentWithAddressSchema = module.paymentWithAddressSchema;

			// Valid: no credit card
			expect(() => paymentWithAddressSchema.parse({ name: "John" })).not.toThrow();

			// Valid: credit card with all dependency fields
			expect(() =>
				paymentWithAddressSchema.parse({
					name: "John",
					creditCard: "1234",
					billingAddress: "123 Main St",
					city: "Springfield",
					zipCode: "62701",
				})
			).not.toThrow();

			// Invalid: credit card without required dependency fields
			try {
				paymentWithAddressSchema.parse({
					name: "John",
					creditCard: "1234",
					city: "Springfield",
				});
				expect.fail("Should have thrown");
			} catch (error: any) {
				expect(error.message).toContain("additional constraints");
				expect(error.message).toContain("billingAddress");
			}
		});

		it("handles multiple dependent properties", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("dependencies.yaml"),
				outputTypes: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			// Verify output
			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("multipleDependenciesSchema");

			// Clear module cache
			delete require.cache[require.resolve(outputPath)];
			const module = await import(`${outputPath}?t=${Date.now()}`);
			const multipleDependenciesSchema = module.multipleDependenciesSchema;

			// Ensure schema exists
			if (!multipleDependenciesSchema) {
				throw new Error(`multipleDependenciesSchema not found in output. Available: ${Object.keys(module).join(", ")}`);
			}

			// Valid: email with verification
			expect(() =>
				multipleDependenciesSchema.parse({
					email: "test@example.com",
					emailVerified: true,
				})
			).not.toThrow();

			// Invalid: email without verification
			try {
				multipleDependenciesSchema.parse({
					email: "test@example.com",
				});
				expect.fail("Should have thrown");
			} catch (error: any) {
				expect(error.message).toContain("emailVerified");
			}
		});
	});

	describe("Edge Cases", () => {
		it("handles special characters in property names", async () => {
			const specialOutputPath = TestUtils.getOutputPath("special-char-deps.ts");
			const testSpec = TestUtils.getFixturePath("special-char-deps.yaml");
			const testContent = `openapi: 3.0.3
info:
  title: Special Characters Test
  version: 1.0.0
components:
  schemas:
    SpecialProps:
      type: object
      properties:
        "user-email":
          type: string
        "email-verified":
          type: boolean
      dependentRequired:
        "user-email": ["email-verified"]
`;
			writeFileSync(testSpec, testContent);

			try {
				const generator = new OpenApiGenerator({
					input: testSpec,
					outputTypes: specialOutputPath,
					mode: "normal",
					showStats: false,
				});

				generator.generate();

				// Verify bracket notation is used
				const output = readFileSync(specialOutputPath, "utf-8");
				expect(output).toContain("specialPropsSchema");
				expect(output).toContain('["user-email"]');

				// Clear module cache
				delete require.cache[require.resolve(specialOutputPath)];
				const module = await import(`${specialOutputPath}?t=${Date.now()}`);
				const specialPropsSchema = module.specialPropsSchema;

				// Ensure schema exists
				if (!specialPropsSchema) {
					throw new Error(`specialPropsSchema not found in output. Available: ${Object.keys(module).join(", ")}`);
				}

				// Valid: email with verification
				expect(() =>
					specialPropsSchema.parse({
						"user-email": "test@example.com",
						"email-verified": true,
					})
				).not.toThrow();

				// Invalid: email without verification
				try {
					specialPropsSchema.parse({
						"user-email": "test@example.com",
					});
					expect.fail("Should have thrown");
				} catch (error: any) {
					expect(error.message).toMatch(/email-verified/);
				}
			} finally {
				try {
					unlinkSync(testSpec);
				} catch {
					// Ignore cleanup errors
				}
			}
		});

		it("handles empty dependency arrays gracefully", () => {
			const edgeOutputPath = TestUtils.getOutputPath("edge-case-deps.ts");
			const testSpec = TestUtils.getFixturePath("edge-case-deps.yaml");
			const testContent = `openapi: 3.0.3
info:
  title: Edge Cases Test
  version: 1.0.0
components:
  schemas:
    EdgeCase:
      type: object
      properties:
        prop1:
          type: string
      dependencies:
        prop1: []
`;
			writeFileSync(testSpec, testContent);
			try {
				const generator = new OpenApiGenerator({
					input: testSpec,
					outputTypes: edgeOutputPath,
					mode: "normal",
					showStats: false,
				});

				expect(() => generator.generate()).not.toThrow();

				const output = readFileSync(edgeOutputPath, "utf-8");
				expect(output).toContain("edgeCaseSchema");
			} finally {
				try {
					unlinkSync(testSpec);
				} catch {
					// Ignore
				}
			}
		});
	});

	describe("Performance", () => {
		it("handles schemas with many dependencies efficiently", () => {
			const perfOutputPath = TestUtils.getOutputPath("many-deps.ts");
			const testSpec = TestUtils.getFixturePath("many-deps.yaml");

			// Build YAML with 20 properties and 10 dependencies
			let yamlContent = `openapi: 3.0.3
info:
  title: Many Dependencies Test
  version: 1.0.0
components:
  schemas:
    ManyDeps:
      type: object
      properties:
`;
			for (let i = 0; i < 20; i++) {
				yamlContent += `        prop${i}:\n          type: string\n`;
			}

			yamlContent += `      dependencies:\n`;
			for (let i = 0; i < 20; i += 2) {
				yamlContent += `        prop${i}:\n`;
				yamlContent += `          - prop${(i + 1) % 20}\n`;
			}

			writeFileSync(testSpec, yamlContent);
			try {
				const startTime = Date.now();
				const generator = new OpenApiGenerator({
					input: testSpec,
					outputTypes: perfOutputPath,
					mode: "normal",
					showStats: false,
				});

				generator.generate();
				const generationTime = Date.now() - startTime;

				expect(generationTime).toBeLessThan(2000);

				const output = readFileSync(perfOutputPath, "utf-8");
				expect(output).toContain("manyDepsSchema");

				console.log(`Generated schema with 20 properties and 10 dependencies in ${generationTime}ms`);
			} finally {
				try {
					unlinkSync(testSpec);
				} catch {
					// Ignore
				}
			}
		});
	});
});
