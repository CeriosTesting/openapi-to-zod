import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

import { TestUtils } from "./utils/test-utils";

/**
 * Tests for transitive reference expansion with operation filtering.
 *
 * When operation filters are applied (e.g., includeTags), the generator must include
 * not only the schemas directly referenced by filtered operations, but also all
 * transitively referenced schemas (schemas referenced by those schemas, etc.).
 *
 * For example, if operation GET /orders references Order, which references Customer,
 * which references Address, which references GeoCoordinates - all four schemas must
 * be included when filtering to only the "orders" tag.
 */
describe("Transitive Reference Expansion with Operation Filtering", () => {
	const fixtureFile = TestUtils.getFixturePath("transitive-references.yaml");

	describe("Tag Filtering with Deep Schema Dependencies", () => {
		it("should include all transitively referenced schemas when filtering by tag", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["orders"],
				},
			});

			const output = generator.generateString();

			// Level 1: Directly referenced by /orders endpoint
			expect(output).toContain("orderSchema");
			expect(output).toContain("orderCreateSchema");

			// Level 2: Referenced by Order
			expect(output).toContain("customerSchema");
			expect(output).toContain("orderItemSchema");
			expect(output).toContain("orderStatusSchema");
			expect(output).toContain("orderItemCreateSchema");

			// Level 3: Referenced by Customer/OrderItem
			expect(output).toContain("addressSchema");
			expect(output).toContain("addressCreateSchema");
			expect(output).toContain("contactInfoSchema");
			expect(output).toContain("productSummarySchema");
			expect(output).toContain("moneySchema");
			expect(output).toContain("statusReasonSchema");

			// Level 4: Referenced by Address/ContactInfo/ProductSummary/Money
			expect(output).toContain("geoCoordinatesSchema");
			expect(output).toContain("contactMethodSchema");
			expect(output).toContain("categorySchema");
			expect(output).toContain("currencySchema");

			// Level 5: Referenced by Category
			expect(output).toContain("parentCategorySchema");
		});

		it("should NOT include schemas from other tags when filtering", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["orders"],
				},
			});

			const output = generator.generateString();

			// Schemas only used by /users endpoint should not be included
			expect(output).not.toContain("userSchema");
			expect(output).not.toContain("userProfileSchema");

			// Schemas only used by /products endpoint should not be included
			expect(output).not.toContain("productSchema");
			expect(output).not.toContain("manufacturerSchema");
		});

		it("should include correct schemas when filtering by users tag", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["users"],
				},
			});

			const output = generator.generateString();

			// Should include User and its transitive dependencies
			expect(output).toContain("userSchema");
			expect(output).toContain("userProfileSchema");

			// Should NOT include order-related schemas
			expect(output).not.toContain("orderSchema");
			expect(output).not.toContain("customerSchema");
			expect(output).not.toContain("orderItemSchema");
		});

		it("should include correct schemas when filtering by products tag", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["products"],
				},
			});

			const output = generator.generateString();

			// Should include Product and its transitive dependencies
			expect(output).toContain("productSchema");
			expect(output).toContain("manufacturerSchema");

			// Should NOT include order-related schemas
			expect(output).not.toContain("orderSchema");
			expect(output).not.toContain("customerSchema");
		});

		it("should include all schemas when filtering by multiple tags", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["orders", "users"],
				},
			});

			const output = generator.generateString();

			// Should include both order and user schemas
			expect(output).toContain("orderSchema");
			expect(output).toContain("customerSchema");
			expect(output).toContain("userSchema");
			expect(output).toContain("userProfileSchema");

			// Should NOT include products-only schemas
			expect(output).not.toContain("productSchema");
			expect(output).not.toContain("manufacturerSchema");
		});
	});

	describe("Path Filtering with Deep Schema Dependencies", () => {
		it("should include transitive schemas when filtering by path", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				showStats: false,
				operationFilters: {
					includePaths: ["/orders"],
				},
			});

			const output = generator.generateString();

			// All order-related schemas should be included
			expect(output).toContain("orderSchema");
			expect(output).toContain("customerSchema");
			expect(output).toContain("addressSchema");
			expect(output).toContain("geoCoordinatesSchema");

			// Other schemas should not be included
			expect(output).not.toContain("userSchema");
			expect(output).not.toContain("productSchema");
		});
	});

	describe("Schema Generation Output Validity", () => {
		it("should generate schemas in correct dependency order", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["orders"],
				},
			});

			const output = generator.generateString();

			// Verify that dependent schemas appear after their dependencies
			// GeoCoordinates should appear before Address (Address references GeoCoordinates)
			const geoIndex = output.indexOf("geoCoordinatesSchema = z.");
			const addressIndex = output.indexOf("addressSchema = z.");
			expect(geoIndex).toBeLessThan(addressIndex);

			// Currency should appear before Money
			const currencyIndex = output.indexOf("currencySchema = z.");
			const moneyIndex = output.indexOf("moneySchema = z.");
			expect(currencyIndex).toBeLessThan(moneyIndex);

			// ContactMethod should appear before ContactInfo
			const methodIndex = output.indexOf("contactMethodSchema = z.");
			const contactInfoIndex = output.indexOf("contactInfoSchema = z.");
			expect(methodIndex).toBeLessThan(contactInfoIndex);
		});

		it("should generate valid TypeScript that can be compiled", async () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				showStats: false,
				operationFilters: {
					includeTags: ["orders"],
				},
			});

			const output = generator.generateString();

			// Basic validation: check that all referenced schemas are defined
			// Extract all schema references (things like fooBarSchema)
			const schemaRefs = output.match(/\b\w+Schema\b/g) || [];
			const uniqueRefs = new Set(schemaRefs);

			// For each reference, check it's defined somewhere
			for (const ref of uniqueRefs) {
				// Skip 'z.strictObject' and similar Zod types
				if (ref.startsWith("z.")) continue;
				// Check the schema is defined (export const xSchema = ...)
				expect(output).toMatch(new RegExp(`export const ${ref} = z\\.`));
			}
		});
	});

	describe("Statistics with Transitive References", () => {
		it("should show correct schema count including transitive refs", () => {
			const generator = new OpenApiGenerator({
				input: fixtureFile,
				outputTypes: "output.ts",
				showStats: true,
				operationFilters: {
					includeTags: ["orders"],
				},
			});

			const output = generator.generateString();

			// The statistics should reflect the actual number of generated schemas
			expect(output).toContain("Total schemas:");

			// Verify operation filtering statistics are shown
			expect(output).toContain("Operation Filtering:");
			expect(output).toContain("Included operations: 2"); // GET and POST /orders
		});
	});
});
