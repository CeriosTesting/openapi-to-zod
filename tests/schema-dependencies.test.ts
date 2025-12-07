import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";

describe("Schema Dependencies (OpenAPI 3.0)", () => {
	const outputPath = join(__dirname, "output", "schema-dependencies.ts");

	beforeEach(() => {
		if (existsSync(outputPath)) {
			rmSync(outputPath);
		}
	});

	afterEach(() => {
		if (existsSync(outputPath)) {
			rmSync(outputPath);
		}
	});

	describe("Schema Dependencies with required", () => {
		it("should generate validation for schema dependencies", () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "schema-dependencies.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("PaymentWithAddress");
			expect(output).toContain("refine");
			expect(output).toContain("safeParse");
		});

		it("should validate when dependent property is not present", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "schema-dependencies.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { paymentWithAddressSchema } = await import(outputPath);

			// Valid: no credit card, so no additional requirements
			const valid = {
				name: "John Doe",
			};
			expect(() => paymentWithAddressSchema.parse(valid)).not.toThrow();
		});

		it("should validate when dependent property exists with all required fields", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "schema-dependencies.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { paymentWithAddressSchema } = await import(outputPath);

			// Valid: credit card with all required dependency fields
			const valid = {
				name: "John Doe",
				creditCard: "1234-5678-9012-3456",
				billingAddress: "123 Main St",
				city: "Springfield",
				zipCode: "62701",
			};
			expect(() => paymentWithAddressSchema.parse(valid)).not.toThrow();
		});

		it("should fail when dependent property exists but required fields are missing", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "schema-dependencies.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { paymentWithAddressSchema } = await import(outputPath);

			// Invalid: credit card without required address fields
			const invalid1 = {
				name: "John Doe",
				creditCard: "1234-5678-9012-3456",
				billingAddress: "123 Main St",
				// Missing city and zipCode
			};
			expect(() => paymentWithAddressSchema.parse(invalid1)).toThrow();

			// Invalid: credit card with only one required field
			const invalid2 = {
				name: "John Doe",
				creditCard: "1234-5678-9012-3456",
				city: "Springfield",
				// Missing billingAddress and zipCode
			};
			expect(() => paymentWithAddressSchema.parse(invalid2)).toThrow();
		});
	});

	describe("Mixed array and schema dependencies", () => {
		it("should handle both dependency types in the same schema", async () => {
			const generator = new ZodSchemaGenerator({
				input: join(__dirname, "fixtures", "schema-dependencies.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { contactWithVerificationSchema } = await import(outputPath);

			// Valid: email with simple required dependency
			const valid1 = {
				email: "test@example.com",
				emailVerified: true,
			};
			expect(() => contactWithVerificationSchema.parse(valid1)).not.toThrow();

			// Valid: phone with schema dependency
			const valid2 = {
				phone: "+1234567890",
				phoneVerified: true,
			};
			expect(() => contactWithVerificationSchema.parse(valid2)).not.toThrow();

			// Valid: both email and phone with their dependencies
			const valid3 = {
				email: "test@example.com",
				emailVerified: true,
				phone: "+1234567890",
				phoneVerified: false,
				verificationDate: "2025-12-07",
			};
			expect(() => contactWithVerificationSchema.parse(valid3)).not.toThrow();

			// Invalid: email without emailVerified
			const invalid1 = {
				email: "test@example.com",
			};
			expect(() => contactWithVerificationSchema.parse(invalid1)).toThrow();

			// Invalid: phone without phoneVerified
			const invalid2 = {
				phone: "+1234567890",
			};
			expect(() => contactWithVerificationSchema.parse(invalid2)).toThrow();
		});
	});
});
