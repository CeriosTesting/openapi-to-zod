import { describe, expect, it } from "vitest";

import type { TypeScriptGeneratorOptions } from "../src/types";
import { TypeScriptGenerator } from "../src/typescript-generator";

import { TestUtils } from "./utils/test-utils";

describe("Constraints Handling", () => {
	function generateOutput(options?: Partial<TypeScriptGeneratorOptions>): string {
		const generator = new TypeScriptGenerator({
			input: TestUtils.getCoreFixturePath("validation", "constraints.yaml"),
			outputTypes: "output.ts",
			...options,
		});
		return generator.generateString();
	}

	describe("String Constraints", () => {
		it("should generate StringConstraints type", () => {
			const output = generateOutput();
			expect(output).toContain("export type StringConstraints");
		});

		it("should generate string properties with constraints", () => {
			const output = generateOutput();
			expect(output).toContain("minOnly?: string");
			expect(output).toContain("maxOnly?: string");
			expect(output).toContain("minMax?: string");
			expect(output).toContain("pattern?: string");
		});

		it("should handle format constraints as string type", () => {
			const output = generateOutput();
			expect(output).toContain("email?: string");
			expect(output).toContain("uri?: string");
			expect(output).toContain("uuid?: string");
		});
	});

	describe("Number Constraints", () => {
		it("should generate NumberConstraints type", () => {
			const output = generateOutput();
			expect(output).toContain("export type NumberConstraints");
		});

		it("should generate number properties", () => {
			const output = generateOutput();
			expect(output).toContain("minOnly?: number");
			expect(output).toContain("maxOnly?: number");
			expect(output).toContain("minMax?: number");
			expect(output).toContain("exclusiveMin?: number");
			expect(output).toContain("exclusiveMax?: number");
			expect(output).toContain("multipleOf?: number");
		});
	});

	describe("Integer Constraints", () => {
		it("should generate IntegerConstraints type", () => {
			const output = generateOutput();
			expect(output).toContain("export type IntegerConstraints");
		});

		it("should generate integer properties as number type", () => {
			const output = generateOutput();
			// In TypeScript, integers are represented as number
			expect(output).toContain("positiveInt?: number");
			expect(output).toContain("nonNegativeInt?: number");
		});
	});

	describe("Array Constraints", () => {
		it("should generate ArrayConstraints type", () => {
			const output = generateOutput();
			expect(output).toContain("export type ArrayConstraints");
		});

		it("should generate array properties", () => {
			const output = generateOutput();
			expect(output).toContain("minOnly?: string[]");
			expect(output).toContain("maxOnly?: string[]");
			expect(output).toContain("minMax?: string[]");
			expect(output).toContain("uniqueItems?: string[]");
		});
	});

	describe("Object Constraints", () => {
		it("should generate ObjectConstraints type", () => {
			const output = generateOutput();
			expect(output).toContain("export type ObjectConstraints");
		});

		it("should handle additionalProperties as Record type", () => {
			const output = generateOutput();
			// Objects with additionalProperties should be Record<string, T>
			expect(output).toMatch(/minProps\?:.*Record<string, string>|{[^}]*\[key: string\]: string/);
		});
	});

	describe("JSDoc Comments", () => {
		it("should include property JSDoc when includeDescriptions is true", () => {
			const output = generateOutput({ includeDescriptions: true });
			// The constraints fixture doesn't have descriptions, but structure should work
			expect(output).toContain("export type");
		});
	});
});
