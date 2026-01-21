import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Zod Import Deduplication", () => {
	function generateOutput(fixture: string, options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath(fixture),
			output: "output.ts",
			...options,
		});
		return generator.generateString();
	}

	it("should only have one Zod import statement", () => {
		const content = generateOutput("type-mode.yaml");
		const zodImports = content.match(/import\s+{\s*z\s*}\s+from\s+["']zod["']/g);

		expect(zodImports).toBeDefined();
		expect(zodImports).toHaveLength(1);
	});

	it("should have Zod import when generating enums (default inferred mode)", () => {
		const content = generateOutput("type-mode.yaml");

		// Should have Zod import
		expect(content).toContain('import { z } from "zod"');

		// Should have enum schemas
		expect(content).toContain("userStatusSchema");
		expect(content).toContain('z.enum(["active", "inactive", "suspended"])');
	});

	it("should always have Zod import for schemas", () => {
		const content = generateOutput("type-mode.yaml", {});

		// Should always have Zod import
		expect(content).toContain('import { z } from "zod"');

		// Should have schemas
		expect(content).toContain("export const userSchema");
	});

	it("should have single Zod import", () => {
		const content = generateOutput("type-mode.yaml", {});
		const zodImports = content.match(/import\s+{\s*z\s*}\s+from\s+["']zod["']/g);

		// Should have exactly one Zod import
		expect(zodImports).toBeDefined();
		expect(zodImports).toHaveLength(1);

		// Should have Zod schemas
		expect(content).toContain("export const userSchema");
	});

	it("should have single Zod import even with multiple enum schemas", () => {
		const content = generateOutput("composition.yaml");
		const zodImports = content.match(/import\s+{\s*z\s*}\s+from\s+["']zod["']/g);

		// Should have exactly one Zod import regardless of number of schemas
		expect(zodImports).toBeDefined();
		expect(zodImports).toHaveLength(1);
	});
});
