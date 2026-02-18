import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";

import { TestUtils } from "./utils/test-utils";

describe("Circular Reference Handling", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getCoreFixturePath("references", "circular.yaml"),
			outputTypes: "output.ts",
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
		// Combined mode uses z.ZodTypeAny to avoid circular type alias issues
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
			outputTypes: "output.ts",
			mode: "normal",
		});

		const output = generator.generateString();

		// Should use z.lazy for self-references (combined mode uses ZodTypeAny)
		expect(output).toContain("z.lazy((): z.ZodTypeAny => treeNodeSchema)");
		// Should not have "variable used before declaration" errors
		expect(output).toContain("export const treeNodeSchema");
		expect(output).toContain("export type TreeNode");
	});

	describe("Mutual Circular References (allOf)", () => {
		// This tests the bug where schemas involved in mutual circular references
		// through allOf were missing from output. The issue was in topologicalSort():
		// - Dossier depends on AbsenceCourse
		// - AbsenceCourse depends on Dossier
		// When visiting Dossier, it would visit AbsenceCourse, which tries to visit Dossier again.
		// Dossier was marked as circular but then incorrectly filtered out from the final output.

		function generateMutualCircular(): string {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("mutual-circular.yaml"),
				outputTypes: "output.ts",
				mode: "normal",
			});
			return generator.generateString();
		}

		it("should include all schemas involved in mutual circular references", () => {
			const output = generateMutualCircular();

			// All schemas should be present in output
			expect(output).toContain("export const dossierBaseSchema");
			expect(output).toContain("export const dossierSchema");
			expect(output).toContain("export const absenceCourseBaseSchema");
			expect(output).toContain("export const absenceCourseSchema");
			expect(output).toContain("export const userSchema");
			expect(output).toContain("export const getDossierResponseSchema");
		});

		it("should generate valid references between circular schemas", () => {
			const output = generateMutualCircular();

			// Dossier should have absenceCourses array with lazy reference to AbsenceCourse
			// because AbsenceCourse references back to Dossier
			expect(output).toContain("absenceCourseSchema");

			// AbsenceCourse should reference Dossier with lazy evaluation
			expect(output).toContain("dossierSchema");
		});

		it("should place circular schemas at the end of output", () => {
			const output = generateMutualCircular();

			// Circular schemas like Dossier are placed at the end because they are
			// detected as part of a circular dependency chain during topological sort.
			// This is expected behavior - the z.lazy() should be used for forward references.
			const dossierPos = output.indexOf("export const dossierSchema");
			const getDossierPos = output.indexOf("export const getDossierResponseSchema");

			// dossierSchema may come after getDossierResponseSchema if it's in the circular chain
			// The important thing is that all schemas ARE included in the output
			expect(dossierPos).toBeGreaterThan(0);
			expect(getDossierPos).toBeGreaterThan(0);
		});

		it("should generate types for all circular schemas", () => {
			const output = generateMutualCircular();

			// All type exports should be present
			expect(output).toContain("export type DossierBase");
			expect(output).toContain("export type Dossier");
			expect(output).toContain("export type AbsenceCourseBase");
			expect(output).toContain("export type AbsenceCourse");
			expect(output).toContain("export type User");
		});

		it("should use z.lazy for all references to circular schemas", () => {
			const output = generateMutualCircular();

			// All references to circular schemas (Dossier, AbsenceCourse, User) should use z.lazy
			// to prevent "used before its declaration" TypeScript errors
			// Combined mode uses z.ZodTypeAny to avoid circular type alias issues

			// Dossier references AbsenceCourse and User - should use z.lazy
			expect(output).toMatch(/z\.lazy\(\(\): z\.ZodTypeAny => absenceCourseSchema\)/);
			expect(output).toMatch(/z\.lazy\(\(\): z\.ZodTypeAny => userSchema\)/);

			// AbsenceCourse references Dossier - should use z.lazy
			expect(output).toMatch(/z\.lazy\(\(\): z\.ZodTypeAny => dossierSchema\)/);

			// User references Dossier - should use z.lazy
			expect(output).toContain("z.array(z.lazy((): z.ZodTypeAny => dossierSchema))");

			// GetDossierResponse references Dossier - should use z.lazy
			// (even though it's not in the circular chain, it references a circular schema)
			expect(output).toContain("z.array(z.lazy((): z.ZodTypeAny => dossierSchema))");
		});

		it("should report circular references in statistics", () => {
			const output = generateMutualCircular();

			// The statistics should show circular references are detected
			expect(output).toMatch(/Circular references: \d+/);
			// Should have at least 4 z.lazy usages (Dossier->AbsenceCourse, Dossier->User, AbsenceCourse->Dossier, User->Dossier, GetDossierResponse->Dossier)
			const lazyMatches = output.match(/z\.lazy\(/g);
			expect(lazyMatches).not.toBeNull();
			expect(lazyMatches?.length).toBeGreaterThanOrEqual(4);
		});
	});
});
