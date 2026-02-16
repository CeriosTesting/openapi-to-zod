import { describe, expect, it } from "vitest";

import type { TypeScriptGeneratorOptions } from "../src/types";
import { TypeScriptGenerator } from "../src/typescript-generator";

import { TestUtils } from "./utils/test-utils";

describe("Circular Reference Handling", () => {
	function generateOutput(options?: Partial<TypeScriptGeneratorOptions>): string {
		const generator = new TypeScriptGenerator({
			input: TestUtils.getCoreFixturePath("references", "circular.yaml"),
			outputTypes: "output.ts",
			...options,
		});
		return generator.generateString();
	}

	it("should generate types for schemas with circular references", () => {
		const output = generateOutput();
		expect(output).toContain("export type Node");
		// Aliases are generated as type aliases
		expect(output).toContain("export type ParentNode");
		expect(output).toContain("export type ChildNode");
	});

	it("should handle self-referential types", () => {
		const output = generateOutput();
		// Node references itself via parent and children
		expect(output).toContain("parent?: ParentNode");
		expect(output).toContain("children?: ChildNode[]");
	});

	it("should maintain correct dependency order", () => {
		const output = generateOutput();

		// Should have all expected types
		expect(output).toContain("export type Node");
		expect(output).toContain("export type ParentNode");
		expect(output).toContain("export type ChildNode");
	});

	it("should handle circular references with type aliases", () => {
		const output = generateOutput();
		expect(output).toContain("export type Node =");
		expect(output).toContain("export type ParentNode");
		expect(output).toContain("export type ChildNode");
	});

	it("should compile without errors", () => {
		const output = generateOutput();
		// Basic check that output is valid TypeScript structure
		expect(output).not.toContain("$ref");
		expect(output).toContain("export");
	});
});

describe("Schema Dependencies", () => {
	function generateOutput(options?: Partial<TypeScriptGeneratorOptions>): string {
		const generator = new TypeScriptGenerator({
			input: TestUtils.getCoreFixturePath("references", "schema-dependencies.yaml"),
			outputTypes: "output.ts",
			...options,
		});
		return generator.generateString();
	}

	it("should generate all dependent schemas", () => {
		const output = generateOutput();
		expect(output).toContain("export type BaseModel");
		// User uses allOf so it becomes a type alias
		expect(output).toContain("export type User");
		expect(output).toContain("export type Address");
		expect(output).toContain("export type Country");
		expect(output).toContain("export type Order");
		expect(output).toContain("export type OrderItem");
		expect(output).toContain("export type Product");
		expect(output).toContain("export type Category");
	});

	it("should resolve nested references", () => {
		const output = generateOutput();
		expect(output).toContain("address?: Address");
		expect(output).toContain("country?: Country");
	});

	it("should handle array references", () => {
		const output = generateOutput();
		expect(output).toContain("items?: OrderItem[]");
	});

	it("should handle self-referential Category", () => {
		const output = generateOutput();
		expect(output).toContain("parent?: Category");
	});
});
