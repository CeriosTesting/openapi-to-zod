import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

/**
 * Tests for edge case improvements:
 * 1. emptyObjectBehavior option
 * 2. allOf conflicting properties warning
 * 3. Optional discriminator fallback to z.union()
 */
describe("Edge Case Improvements", () => {
	const fixturePath = TestUtils.getFixturePath("edge-case-improvements.yaml");

	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: fixturePath,
			...options,
		});
		return generator.generateString();
	}

	describe("emptyObjectBehavior Option", () => {
		it("should default to z.looseObject({}) for empty objects", () => {
			const output = generateOutput();

			// Default is 'loose'
			expect(output).toContain("emptySchema");
			expect(output).toMatch(/z\.looseObject\(\{\s*\}\)/);
		});

		it("should use z.strictObject({}) when emptyObjectBehavior is 'strict'", () => {
			const output = generateOutput({ emptyObjectBehavior: "strict" });

			expect(output).toContain("emptySchema");
			expect(output).toMatch(/z\.strictObject\(\{\s*\}\)/);
		});

		it("should use z.looseObject({}) when emptyObjectBehavior is 'loose'", () => {
			const output = generateOutput({ emptyObjectBehavior: "loose" });

			expect(output).toContain("emptySchema");
			expect(output).toMatch(/z\.looseObject\(\{\s*\}\)/);
		});

		it("should use z.record() when emptyObjectBehavior is 'record'", () => {
			const output = generateOutput({ emptyObjectBehavior: "record" });

			expect(output).toContain("emptySchema");
			expect(output).toMatch(/z\.record\(z\.string\(\),\s*z\.unknown\(\)\)/);
		});

		it("should apply emptyObjectBehavior to nested empty objects", () => {
			const output = generateOutput({ emptyObjectBehavior: "strict" });

			// ContainerWithEmpty has a nested empty object property 'data'
			expect(output).toContain("containerWithEmptySchema");
			// The nested 'data' property should use strictObject
			expect(output).toMatch(/data:\s*z\.strictObject\(\{\s*\}\)/);
		});

		it("should not affect objects with properties", () => {
			const output = generateOutput({ emptyObjectBehavior: "strict" });

			// BaseWithName has properties, should not be affected by emptyObjectBehavior
			expect(output).toContain("baseWithNameSchema");
			// It should not have empty strictObject but should have normal object with properties
			expect(output).toMatch(/baseWithNameSchema.*z\.(object|strictObject|looseObject)\(\{[^}]+name/s);
		});
	});

	describe("allOf Conflicting Properties Warning", () => {
		let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		});

		afterEach(() => {
			consoleWarnSpy.mockRestore();
		});

		it("should warn when allOf has conflicting property definitions", () => {
			generateOutput();

			// Should have warned about conflicting 'name' property
			const warnCalls = consoleWarnSpy.mock.calls.map((call: unknown[]) => call[0]);
			const conflictWarning = warnCalls.find(
				(msg: unknown) => typeof msg === "string" && msg.includes("allOf composition conflict") && msg.includes("name")
			);
			expect(conflictWarning).toBeDefined();
		});

		it("should add .describe() with conflict information", () => {
			const output = generateOutput();

			// ConflictingAllOf should have a describe mentioning the conflict
			expect(output).toContain("conflictingAllOfSchema");
			expect(output).toMatch(/conflictingAllOfSchema.*\.describe\(.*conflict/is);
		});

		it("should not warn for non-conflicting allOf", () => {
			consoleWarnSpy.mockClear();

			generateOutput();

			const warnCalls = consoleWarnSpy.mock.calls.map((call: unknown[]) => call[0]);
			// NonConflictingAllOf has different properties, no conflict
			const statusConflict = warnCalls.find(
				(msg: unknown) => typeof msg === "string" && msg.includes("conflict") && msg.includes("status")
			);
			expect(statusConflict).toBeUndefined();
		});

		it("should detect inline schema conflicts", () => {
			generateOutput();

			const warnCalls = consoleWarnSpy.mock.calls.map((call: unknown[]) => call[0]);
			// InlineConflictingAllOf has 'count' defined as integer and string
			const countConflict = warnCalls.find(
				(msg: unknown) => typeof msg === "string" && msg.includes("allOf composition conflict") && msg.includes("count")
			);
			expect(countConflict).toBeDefined();
		});
	});

	describe("Optional Discriminator Fallback", () => {
		let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		});

		afterEach(() => {
			consoleWarnSpy.mockRestore();
		});

		it("should fallback to z.union() when discriminator is optional", () => {
			const output = generateOutput();

			// OptionalDiscriminatorUnion has 'type' as optional in both variants
			expect(output).toContain("optionalDiscriminatorUnionSchema");
			// Should use z.union, not z.discriminatedUnion
			expect(output).toMatch(/optionalDiscriminatorUnionSchema\s*=\s*z\.union\(/);
			expect(output).not.toMatch(/optionalDiscriminatorUnionSchema\s*=\s*z\.discriminatedUnion\(/);
		});

		it("should warn when falling back from discriminatedUnion", () => {
			generateOutput();

			const warnCalls = consoleWarnSpy.mock.calls.map((call: unknown[]) => call[0]);
			const fallbackWarning = warnCalls.find(
				(msg: unknown) =>
					typeof msg === "string" &&
					msg.includes("Discriminator") &&
					msg.includes("is not required") &&
					msg.includes("Falling back")
			);
			expect(fallbackWarning).toBeDefined();
		});

		it("should add .describe() explaining the fallback", () => {
			const output = generateOutput();

			// Should have describe explaining why z.union was used
			expect(output).toMatch(/optionalDiscriminatorUnionSchema.*\.describe\(.*optional.*z\.union/is);
		});

		it("should use z.discriminatedUnion() when discriminator is required in all variants", () => {
			const output = generateOutput();

			// RequiredDiscriminatorUnion has 'kind' required in both variants
			expect(output).toContain("requiredDiscriminatorUnionSchema");
			expect(output).toMatch(/requiredDiscriminatorUnionSchema\s*=\s*z\.discriminatedUnion\("kind"/);
		});

		it("should not warn for required discriminators", () => {
			consoleWarnSpy.mockClear();

			generateOutput();

			const warnCalls = consoleWarnSpy.mock.calls.map((call: unknown[]) => call[0]);
			// Should not warn about 'kind' discriminator since it's required
			const kindWarning = warnCalls.find(
				(msg: unknown) =>
					typeof msg === "string" && msg.includes('Discriminator "kind"') && msg.includes("not required")
			);
			expect(kindWarning).toBeUndefined();
		});

		it("should fallback when even one variant has optional discriminator", () => {
			const output = generateOutput();

			// MixedDiscriminatorUnion mixes required and optional
			expect(output).toContain("mixedDiscriminatorUnionSchema");
			// Should fallback to z.union since one variant has optional 'type'
			expect(output).toMatch(/mixedDiscriminatorUnionSchema\s*=\s*z\.union\(/);
		});
	});

	describe("Combined Edge Cases", () => {
		it("should handle schema with empty nested objects and allOf", () => {
			const output = generateOutput({ emptyObjectBehavior: "loose" });

			expect(output).toContain("complexEdgeCaseSchema");
			// Should have loose empty object for metadata
			expect(output).toMatch(/metadata:\s*z\.looseObject\(\{\s*\}\)/);
			// Should have proper object for config (since it has properties)
			expect(output).toMatch(/config:/);
			expect(output).toMatch(/enabled:/);
		});
	});

	describe("Backward Compatibility", () => {
		it("should generate valid TypeScript when combining all options", () => {
			const output = generateOutput({
				emptyObjectBehavior: "loose",
				mode: "normal",
				includeDescriptions: true,
			});

			// Should compile without errors
			expect(output).toContain("import { z } from");
			expect(output).toContain("export const");
			// Should not have syntax errors from combined describe calls
			expect(output).not.toMatch(/\.describe\(.*\.describe\(/);
		});

		it("should work with default options", () => {
			const output = generateOutput();

			// All schemas should be generated
			expect(output).toContain("emptySchema");
			expect(output).toContain("baseWithNameSchema");
			expect(output).toContain("conflictingAllOfSchema");
			expect(output).toContain("optionalDiscriminatorUnionSchema");
			expect(output).toContain("requiredDiscriminatorUnionSchema");
		});
	});
});
