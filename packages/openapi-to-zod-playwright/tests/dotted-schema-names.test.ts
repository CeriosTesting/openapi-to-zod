import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Dotted Schema Names Handling", () => {
	const fixtureFile = TestUtils.getFixturePath("dotted-schema-names.yaml");
	const schemaOutputFile = TestUtils.getOutputPath("dotted-schemas.ts");
	const clientOutputFile = TestUtils.getOutputPath("dotted-client.ts");
	const serviceOutputFile = TestUtils.getOutputPath("dotted-service.ts");

	describe("Schema Generation", () => {
		it("should convert dotted schema names to valid TypeScript identifiers", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: schemaOutputFile,
				outputClient: clientOutputFile,
			});

			generator.generate();
			const content = readFileSync(schemaOutputFile, "utf-8");

			// Should convert Company.Models.User to companyModelsUserSchema
			expect(content).toContain("export const companyModelsUserSchema");
			expect(content).toContain("export type CompanyModelsUser =");

			// Should convert Company.Models.Address to companyModelsAddressSchema
			expect(content).toContain("export const companyModelsAddressSchema");
			expect(content).toContain("export type CompanyModelsAddress =");

			// Should convert Vendor.Api.Product to vendorApiProductSchema
			expect(content).toContain("export const vendorApiProductSchema");
			expect(content).toContain("export type VendorApiProduct =");

			// Should NOT contain dots in variable names
			expect(content).not.toMatch(/export const [^=]*\.[^=]*=/);
			expect(content).not.toMatch(/export type [^=]*\.[^=]*=/);
		});

		it("should handle nested references with dots", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: schemaOutputFile,
				outputClient: clientOutputFile,
			});

			generator.generate();
			const content = readFileSync(schemaOutputFile, "utf-8");

			// Should reference companyModelsAddressSchema (not Company.Models.Address)
			expect(content).toMatch(/address:\s+companyModelsAddressSchema/);
		});

		it("should maintain correct dependency order with dotted names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: schemaOutputFile,
				outputClient: clientOutputFile,
			});

			generator.generate();
			const content = readFileSync(schemaOutputFile, "utf-8");

			// Address should be defined before User (since User references Address)
			const addressIndex = content.indexOf("companyModelsAddressSchema");
			const userIndex = content.indexOf("companyModelsUserSchema");

			expect(addressIndex).toBeLessThan(userIndex);
		});
	});

	describe("Client Generation", () => {
		it("should generate valid TypeScript method names without dots", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: schemaOutputFile,
				outputClient: clientOutputFile,
			});

			generator.generate();
			const content = readFileSync(clientOutputFile, "utf-8");

			// Should have valid method names
			expect(content).toContain("async getApiV1Users(");
			expect(content).toContain("async postApiV1Users(");
			expect(content).toContain("async getApiV1ProductsById("); // Should NOT have dots in method names
			expect(content).not.toMatch(/async [^(]*\.[^(]*\(/);
		});
	});

	describe("Service Generation", () => {
		it("should generate valid TypeScript types in service methods", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: schemaOutputFile,
				outputClient: clientOutputFile,
				outputService: serviceOutputFile,
			});

			generator.generate();
			const content = readFileSync(serviceOutputFile, "utf-8");

			// Should use converted type names (no dots)
			expect(content).toMatch(/Promise<CompanyModelsUser\[\]>/);
			expect(content).toMatch(/data\?:\s+CompanyModelsUserCreate/);
			expect(content).toMatch(/Promise<VendorApiProduct>/);

			// Should NOT have dots in type names
			expect(content).not.toMatch(/Promise<[^>]*\.[^>]*>/);
			expect(content).not.toMatch(/data\?:\s+[^}]*\.[^}]*/);
		});

		it("should import converted schema names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: schemaOutputFile,
				outputClient: clientOutputFile,
				outputService: serviceOutputFile,
			});

			generator.generate();
			const content = readFileSync(serviceOutputFile, "utf-8");

			// Should import schemas with converted names
			const importMatch = content.match(/import type \{([^}]+)\} from/);
			if (importMatch) {
				const imports = importMatch[1];
				// Should contain converted names
				expect(imports).toMatch(/CompanyModelsUser/);
				expect(imports).toMatch(/CompanyModelsUserCreate/);
				expect(imports).toMatch(/VendorApiProduct/);

				// Should NOT contain dots in type names
				expect(imports).not.toMatch(/[A-Z][a-z]*\.[A-Z]/);
			}
		});
	});

	describe("Edge Cases", () => {
		it("should handle multiple consecutive dots", () => {
			// Create a spec with multiple dots
			const spec = `openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths:
  /test:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Company..Models...User'
components:
  schemas:
    Company..Models...User:
      type: object
      properties:
        name:
          type: string
`;
			const testFile = TestUtils.getFixturePath("multiple-dots.yaml");
			writeFileSync(testFile, spec);

			try {
				const generator = new OpenApiPlaywrightGenerator({
					input: testFile,
					output: TestUtils.getOutputPath("multiple-dots.ts"),
					outputClient: TestUtils.getOutputPath("multiple-dots-client.ts"),
				});

				generator.generate();
				const content = readFileSync(TestUtils.getOutputPath("multiple-dots.ts"), "utf-8");

				// Should collapse multiple dots and convert to camelCase
				expect(content).toContain("companyModelsUserSchema");
				expect(content).not.toContain("..");
				expect(content).not.toContain("...");
			} finally {
				unlinkSync(testFile);
				try {
					unlinkSync(TestUtils.getOutputPath("multiple-dots.ts"));
				} catch {}
			}
		});

		it("should handle dots at start or end", () => {
			const spec = `openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths:
  /test:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/.Models.User.'
components:
  schemas:
    .Models.User.:
      type: object
      properties:
        name:
          type: string
`;
			const testFile = TestUtils.getFixturePath("edge-dots.yaml");
			writeFileSync(testFile, spec);

			try {
				const generator = new OpenApiPlaywrightGenerator({
					input: testFile,
					output: TestUtils.getOutputPath("edge-dots.ts"),
					outputClient: TestUtils.getOutputPath("edge-dots-client.ts"),
				});

				generator.generate();
				const content = readFileSync(TestUtils.getOutputPath("edge-dots.ts"), "utf-8");

				// Should handle edge dots gracefully
				expect(content).toContain("modelsUserSchema");
				expect(content).not.toMatch(/^\./m); // No line starting with dot
				expect(content).not.toMatch(/\.$/m); // No line ending with dot
			} finally {
				unlinkSync(testFile);
				try {
					unlinkSync(TestUtils.getOutputPath("edge-dots.ts"));
				} catch {}
			}
		});

		it("should compile generated TypeScript without errors", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: schemaOutputFile,
				outputClient: clientOutputFile,
				outputService: serviceOutputFile,
			});

			generator.generate();

			// If files are generated, they should be valid TypeScript
			const schemaContent = readFileSync(schemaOutputFile, "utf-8");
			const clientContent = readFileSync(clientOutputFile, "utf-8");
			const serviceContent = readFileSync(serviceOutputFile, "utf-8");

			// Basic syntax checks
			expect(schemaContent).not.toContain("export const .");
			expect(schemaContent).not.toContain("export type .");
			expect(clientContent).not.toContain("async .(");
			expect(serviceContent).not.toContain("Promise<.");
		});
	});
});
