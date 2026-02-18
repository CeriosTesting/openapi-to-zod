import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";

import { TestUtils } from "./utils/test-utils";

/**
 * Tests for ensuring z.lazy() is only used when truly necessary.
 *
 * z.lazy() should be used for:
 * 1. Self-referencing schemas (e.g., TreeNode with children: TreeNode[])
 * 2. Mutually circular schemas (A -> B -> A)
 *
 * z.lazy() should NOT be used for:
 * 1. One-way references to self-referencing schemas
 *    (e.g., Container referencing TreeNode, where TreeNode is self-referencing)
 */
describe("Unnecessary z.lazy() Prevention", () => {
	describe("One-way reference to self-referencing schema", () => {
		function generateOneWayRef(): string {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("one-way-circular-ref.yaml"),
				outputTypes: "output.ts",
				mode: "normal",
			});
			return generator.generateString();
		}

		it("should use z.lazy() for self-referencing innerException", () => {
			const output = generateOneWayRef();

			// DecisionTreeException.innerException should use z.lazy() (self-reference)
			// Combined mode uses z.ZodTypeAny to avoid circular type alias issues
			expect(output).toMatch(/innerException:\s*z\.lazy\(\(\): z\.ZodTypeAny => decisionTreeExceptionSchema\)/);
		});

		it("should NOT use z.lazy() for one-way reference from DecisionTree to DecisionTreeException", () => {
			const output = generateOneWayRef();

			// DecisionTree.exceptions should NOT use z.lazy() - it's a one-way reference
			// The DecisionTreeException schema is defined before DecisionTree
			expect(output).toMatch(/exceptions:\s*z\.array\(decisionTreeExceptionSchema\)/);

			// Make sure we don't have z.lazy for this specific case
			expect(output).not.toMatch(
				/exceptions:\s*z\.array\(z\.lazy\(\(\): z\.ZodTypeAny => decisionTreeExceptionSchema\)\)/
			);
		});

		it("should only have ONE z.lazy() occurrence for innerException self-reference", () => {
			const output = generateOneWayRef();

			// Count z.lazy occurrences - should only be 1 for innerException
			const lazyMatches = output.match(/z\.lazy\(/g) || [];
			expect(lazyMatches.length).toBe(1);

			// Verify it's the innerException (combined mode uses ZodTypeAny)
			expect(output).toMatch(/innerException:\s*z\.lazy\(\(\): z\.ZodTypeAny => decisionTreeExceptionSchema\)/);
		});

		it("should NOT use z.lazy() for other array references", () => {
			const output = generateOneWayRef();

			// question, answers, infoLines should all be direct references
			expect(output).toMatch(/question:\s*decisionTreeQuestionSchema/);
			expect(output).toMatch(/answers:\s*z\.array\(decisionTreeAnswerSchema\)/);
			expect(output).toMatch(/infoLines:\s*z\.array\(decisionTreeInfoLineSchema\)/);

			// None of these should use z.lazy
			expect(output).not.toMatch(/question:\s*z\.lazy/);
			expect(output).not.toMatch(/answers:\s*z\.array\(z\.lazy/);
			expect(output).not.toMatch(/infoLines:\s*z\.array\(z\.lazy/);
		});
	});

	describe("Mutually circular schemas still use z.lazy()", () => {
		// Uses the existing mutual-circular.yaml fixture
		function generateMutualCircular(): string {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("mutual-circular.yaml"),
				outputTypes: "output.ts",
				mode: "normal",
			});
			return generator.generateString();
		}

		it("should use z.lazy() for mutually circular references", () => {
			const output = generateMutualCircular();

			// Both Dossier and AbsenceCourse are mutually circular - at least one needs z.lazy
			// Combined mode uses z.ZodTypeAny to avoid circular type alias issues
			const hasLazyDossier = output.match(/z\.lazy\(\(\): z\.ZodTypeAny => dossierSchema\)/);
			const hasLazyAbsenceCourse = output.match(/z\.lazy\(\(\): z\.ZodTypeAny => absenceCourseSchema\)/);

			// At least one direction must use lazy
			expect(hasLazyDossier || hasLazyAbsenceCourse).toBeTruthy();
		});
	});

	describe("Three-level chain with self-reference at end", () => {
		// Uses the existing self-reference.yaml fixture
		function generateWithSelfRef(): string {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("self-reference.yaml"),
				outputTypes: "output.ts",
				mode: "normal",
			});
			return generator.generateString();
		}

		it("should use z.lazy() only for TreeNode self-reference", () => {
			const output = generateWithSelfRef();

			// TreeNode should use z.lazy() for its self-references (left, right, children)
			// Combined mode uses z.ZodTypeAny to avoid circular type alias issues
			expect(output).toMatch(/z\.lazy\(\(\): z\.ZodTypeAny => treeNodeSchema\)/);
		});
	});

	describe("z.lazy() type annotation in combined vs separate mode", () => {
		it("should use z.ZodTypeAny in combined mode to avoid circular type alias issues", () => {
			// In combined mode, types are inferred with z.infer which causes circular type alias errors
			// when using z.ZodType<TypeName>. So we use z.ZodTypeAny in this mode.
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("one-way-circular-ref.yaml"),
				outputTypes: "output.ts",
				mode: "normal",
			});
			const output = generator.generateString();

			// Combined mode should use z.ZodTypeAny
			expect(output).toContain("z.ZodTypeAny");
		});
	});
});
