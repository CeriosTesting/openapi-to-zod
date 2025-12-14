import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import { TestUtils } from "./utils/test-utils";

describe("Array Contains", () => {
	const outputPath = TestUtils.getOutputPath("array-contains.ts");

	describe("Basic Contains", () => {
		it("should generate validation for contains", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("array-contains.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("AdminUsers");
			expect(output).toContain("refine");
			expect(output).toContain("safeParse");
		});

		it("should validate arrays with at least one matching item", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("array-contains.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { adminUsersSchema } = await import(outputPath);

			// Valid: has at least one admin
			const valid = [
				{ name: "Alice", role: "user" },
				{ name: "Bob", role: "admin" },
				{ name: "Charlie", role: "user" },
			];
			expect(() => adminUsersSchema.parse(valid)).not.toThrow();

			// Invalid: no admin
			const invalid = [
				{ name: "Alice", role: "user" },
				{ name: "Charlie", role: "user" },
			];
			expect(() => adminUsersSchema.parse(invalid)).toThrow();
		});
	});

	describe("Contains with minContains and maxContains", () => {
		it("should validate min and max contains constraints", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("array-contains.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { taggedItemsSchema } = await import(outputPath);

			// Valid: 2 tagged items (within 1-3 range)
			const valid1 = ["tag_important", "tag_urgent", "regular"];
			expect(() => taggedItemsSchema.parse(valid1)).not.toThrow();

			// Valid: exactly 1 tagged item
			const valid2 = ["tag_important", "regular1", "regular2"];
			expect(() => taggedItemsSchema.parse(valid2)).not.toThrow();

			// Valid: exactly 3 tagged items
			const valid3 = ["tag_a", "tag_b", "tag_c", "regular"];
			expect(() => taggedItemsSchema.parse(valid3)).not.toThrow();

			// Invalid: 0 tagged items (less than min)
			const invalid1 = ["regular1", "regular2"];
			expect(() => taggedItemsSchema.parse(invalid1)).toThrow();

			// Invalid: 4 tagged items (more than max)
			const invalid2 = ["tag_a", "tag_b", "tag_c", "tag_d"];
			expect(() => taggedItemsSchema.parse(invalid2)).toThrow();
		});
	});

	describe("Contains with minContains only", () => {
		it("should validate minimum contains constraint", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("array-contains.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { mixedNumbersSchema } = await import(outputPath);

			// Valid: 2 numbers >= 100
			const valid1 = [10, 20, 100, 150];
			expect(() => mixedNumbersSchema.parse(valid1)).not.toThrow();

			// Valid: 3 numbers >= 100
			const valid2 = [10, 100, 200, 300];
			expect(() => mixedNumbersSchema.parse(valid2)).not.toThrow();

			// Invalid: only 1 number >= 100
			const invalid1 = [10, 20, 30, 100];
			expect(() => mixedNumbersSchema.parse(invalid1)).toThrow();

			// Invalid: 0 numbers >= 100
			const invalid2 = [10, 20, 30, 40];
			expect(() => mixedNumbersSchema.parse(invalid2)).toThrow();
		});
	});

	describe("Contains with enum values", () => {
		it("should validate enum-based contains", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("array-contains.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { requiredKeywordsSchema } = await import(outputPath);

			// Valid: 1 keyword (within 1-2 range)
			const valid1 = ["urgent", "normal", "low"];
			expect(() => requiredKeywordsSchema.parse(valid1)).not.toThrow();

			// Valid: 2 keywords
			const valid2 = ["critical", "important", "normal"];
			expect(() => requiredKeywordsSchema.parse(valid2)).not.toThrow();

			// Invalid: 0 keywords
			const invalid1 = ["normal", "low"];
			expect(() => requiredKeywordsSchema.parse(invalid1)).toThrow();

			// Invalid: 3 keywords (more than max)
			const invalid2 = ["urgent", "critical", "important"];
			expect(() => requiredKeywordsSchema.parse(invalid2)).toThrow();
		});
	});
});
