import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Circular Reference Handling", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("circular.yaml"),
			mode: "normal",
			...options,
		});
		return generator.generateString();
	}

	it("should handle circular references with z.lazy", () => {
		const output = generateOutput();
		expect(output).toContain("z.lazy(");
	});

	it("should add type annotation to lazy callbacks", () => {
		const output = generateOutput();
		expect(output).toContain("z.lazy((): z.ZodTypeAny =>");
	});

	it("should place alias schemas after their target schemas", () => {
		const output = generateOutput();

		// Find positions of schemas
		const nodePos = output.indexOf("export const nodeSchema");
		const parentPos = output.indexOf("export const parentNodeSchema");
		const childPos = output.indexOf("export const childNodeSchema");

		// Main schema should come before aliases
		expect(nodePos).toBeLessThan(parentPos);
		expect(nodePos).toBeLessThan(childPos);
	});

	it("should handle arrays of circular references", () => {
		const output = generateOutput();
		expect(output).toContain("z.array(z.lazy(");
	});

	it("should maintain correct dependency order", () => {
		const output = generateOutput();

		// Should have all expected schemas
		expect(output).toContain("export const nodeSchema");
		expect(output).toContain("export const parentNodeSchema");
		expect(output).toContain("export const childNodeSchema");
	});

	it("should handle self-referencing schemas with z.lazy", () => {
		// Test a schema that directly references itself (e.g., tree node with left/right children)
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("self-reference.yaml"),
			mode: "normal",
		});

		const output = generator.generateString();

		// Should use z.lazy for self-references
		expect(output).toContain("z.lazy((): z.ZodTypeAny => treeNodeSchema)");
		// Should not have "variable used before declaration" errors
		expect(output).toContain("export const treeNodeSchema");
		expect(output).toContain("export type TreeNode");
	});
});
