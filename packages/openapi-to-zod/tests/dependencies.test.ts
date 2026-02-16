import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

import { TestUtils } from "./utils/test-utils";

describe("Dependencies (OpenAPI 3.0)", () => {
	const outputPath = TestUtils.getOutputPath("dependencies.ts");

	describe("Property Dependencies", () => {
		it("should generate validation for dependencies", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("dependencies.yaml"),
				outputTypes: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("CreditCard");
			expect(output).toContain("superRefine");
			expect(output).toContain("securityCode");
			expect(output).toContain("billingZip");
		});

		it("should validate credit card dependencies", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("dependencies.yaml"),
				outputTypes: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { creditCardSchema } = await import(outputPath);

			// Valid: no credit card, so no dependencies required
			const valid1 = {
				name: "John Doe",
			};
			expect(() => creditCardSchema.parse(valid1)).not.toThrow();

			// Valid: credit card with all required dependencies
			const valid2 = {
				name: "John Doe",
				creditCard: "1234-5678-9012-3456",
				securityCode: "123",
				billingZip: "12345",
			};
			expect(() => creditCardSchema.parse(valid2)).not.toThrow();

			// Invalid: credit card without securityCode
			const invalid1 = {
				name: "John Doe",
				creditCard: "1234-5678-9012-3456",
				billingZip: "12345",
			};
			expect(() => creditCardSchema.parse(invalid1)).toThrow();

			// Invalid: credit card without billingZip
			const invalid2 = {
				name: "John Doe",
				creditCard: "1234-5678-9012-3456",
				securityCode: "123",
			};
			expect(() => creditCardSchema.parse(invalid2)).toThrow();

			// Invalid: credit card without both dependencies
			const invalid3 = {
				name: "John Doe",
				creditCard: "1234-5678-9012-3456",
			};
			expect(() => creditCardSchema.parse(invalid3)).toThrow();
		});

		it("should validate billing address dependencies", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("dependencies.yaml"),
				outputTypes: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { billingAddressSchema } = await import(outputPath);

			// Valid: no billing address
			const valid1 = {
				name: "John Doe",
			};
			expect(() => billingAddressSchema.parse(valid1)).not.toThrow();

			// Valid: billing address with all dependencies
			const valid2 = {
				name: "John Doe",
				billingAddress: "123 Main St",
				city: "Springfield",
				state: "IL",
				zipCode: "62701",
			};
			expect(() => billingAddressSchema.parse(valid2)).not.toThrow();

			// Invalid: missing city
			const invalid = {
				name: "John Doe",
				billingAddress: "123 Main St",
				state: "IL",
				zipCode: "62701",
			};
			expect(() => billingAddressSchema.parse(invalid)).toThrow();
		});

		it("should validate multiple dependencies", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("dependencies.yaml"),
				outputTypes: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { multipleDependenciesSchema } = await import(outputPath);

			// Valid: no contact methods
			const valid1 = {};
			expect(() => multipleDependenciesSchema.parse(valid1)).not.toThrow();

			// Valid: email with emailVerified
			const valid2 = {
				email: "test@example.com",
				emailVerified: true,
			};
			expect(() => multipleDependenciesSchema.parse(valid2)).not.toThrow();

			// Valid: both email and phone with their verifications
			const valid3 = {
				email: "test@example.com",
				emailVerified: true,
				phone: "+1234567890",
				phoneVerified: false,
			};
			expect(() => multipleDependenciesSchema.parse(valid3)).not.toThrow();

			// Invalid: email without emailVerified
			const invalid1 = {
				email: "test@example.com",
			};
			expect(() => multipleDependenciesSchema.parse(invalid1)).toThrow();

			// Invalid: phone without phoneVerified
			const invalid2 = {
				phone: "+1234567890",
			};
			expect(() => multipleDependenciesSchema.parse(invalid2)).toThrow();
		});
	});
});
