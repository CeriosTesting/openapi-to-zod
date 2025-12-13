import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import { TestUtils } from "./utils/test-utils";

describe("Unevaluated Properties and Items (OpenAPI 3.1)", () => {
	const outputPath = TestUtils.getOutputPath("unevaluated.ts");

	describe("unevaluatedProperties", () => {
		it("should generate validation for unevaluatedProperties: false", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("unevaluated.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("ExtendedEntity");
			expect(output).toContain("refine");
			expect(output).toContain("unevaluated");
		});

		it("should reject objects with unevaluated properties when false", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("unevaluated.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { extendedEntitySchema } = await import(outputPath);

			// Valid: only expected properties
			const valid = {
				id: "123",
				name: "Test",
				createdAt: "2024-01-01T00:00:00Z",
			};
			expect(() => extendedEntitySchema.parse(valid)).not.toThrow();

			// Invalid: has unevaluated property
			const invalid = {
				id: "123",
				name: "Test",
				createdAt: "2024-01-01T00:00:00Z",
				extraProp: "not allowed",
			};
			expect(() => extendedEntitySchema.parse(invalid)).toThrow();
		});

		it("should allow typed unevaluated properties with schema", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("unevaluated.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { flexibleExtensionSchema } = await import(outputPath);

			// Valid: unevaluated props are strings
			const valid = {
				id: "123",
				type: "user",
				createdAt: "2024-01-01T00:00:00Z",
				customField1: "value1",
				customField2: "value2",
			};
			expect(() => flexibleExtensionSchema.parse(valid)).not.toThrow();

			// Invalid: unevaluated prop is not a string
			const invalid = {
				id: "123",
				type: "user",
				customField: 123, // should be string
			};
			expect(() => flexibleExtensionSchema.parse(invalid)).toThrow();
		});

		it("should work with oneOf composition", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("unevaluated.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { paymentMethodSchema } = await import(outputPath);

			// Valid: has paymentId and cardNumber
			const valid1 = {
				paymentId: "pay_123",
				cardNumber: "4111111111111111",
			};
			expect(() => paymentMethodSchema.parse(valid1)).not.toThrow();

			// Valid: has paymentId and bankAccount
			const valid2 = {
				paymentId: "pay_123",
				bankAccount: "123456789",
			};
			expect(() => paymentMethodSchema.parse(valid2)).not.toThrow();

			// Invalid: has unevaluated property
			const invalid = {
				paymentId: "pay_123",
				cardNumber: "4111111111111111",
				extraProp: "not allowed",
			};
			expect(() => paymentMethodSchema.parse(invalid)).toThrow();
		});

		it("should handle anyOf with unevaluated properties", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("unevaluated.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { complexCompositionSchema } = await import(outputPath);

			// Valid: has version and feature1 (string)
			const valid1 = {
				version: "1.0",
				feature1: "enabled",
			};
			expect(() => complexCompositionSchema.parse(valid1)).not.toThrow();

			// Valid: has version, feature2 (number), and unevaluated boolean
			const valid2 = {
				version: "1.0",
				feature2: 42,
				customFlag: true,
			};
			expect(() => complexCompositionSchema.parse(valid2)).not.toThrow();

			// Invalid: unevaluated property is not boolean
			const invalid = {
				version: "1.0",
				feature1: "enabled",
				customFlag: "not a boolean",
			};
			expect(() => complexCompositionSchema.parse(invalid)).toThrow();
		});
	});

	describe("unevaluatedItems", () => {
		it("should generate validation for unevaluatedItems: false", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("unevaluated.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("MixedArray");
			expect(output).toContain("refine");
		});

		it("should reject arrays with items beyond prefixItems when false", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("unevaluated.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { mixedArraySchema } = await import(outputPath);

			// Valid: exactly 2 items matching prefixItems
			const valid = ["Alice", 30];
			expect(() => mixedArraySchema.parse(valid)).not.toThrow();

			// Invalid: has extra item
			const invalid = ["Alice", 30, "extra"];
			expect(() => mixedArraySchema.parse(invalid)).toThrow();
		});

		it("should allow typed unevaluated items with schema", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("unevaluated.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { flexibleTupleSchema } = await import(outputPath);

			// Valid: first 2 items match prefix, rest are booleans
			const valid = ["name", 25, true, false, true];
			expect(() => flexibleTupleSchema.parse(valid)).not.toThrow();

			// Invalid: extra items are not booleans
			const invalid = ["name", 25, true, "not a boolean"];
			expect(() => flexibleTupleSchema.parse(invalid)).toThrow();
		});

		it("should work with allOf composition", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("unevaluated.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { restrictedArraySchema } = await import(outputPath);

			// Valid: array of numbers within constraints
			const valid = [1, 2, 3, 4, 5];
			expect(() => restrictedArraySchema.parse(valid)).not.toThrow();
		});
	});
});
