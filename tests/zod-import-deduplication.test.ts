import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";

describe("Zod Import Deduplication", () => {
	const outputFile = "tests/output/zod-import-test.ts";

	afterEach(() => {
		if (existsSync(outputFile)) {
			unlinkSync(outputFile);
		}
	});

	it("should only have one Zod import statement", () => {
		const generator = new ZodSchemaGenerator({
			input: "tests/fixtures/type-mode.yaml",
			output: outputFile,
			typeMode: "inferred",
		});

		generator.generate();

		const content = readFileSync(outputFile, "utf-8");
		const zodImports = content.match(/import\s+{\s*z\s*}\s+from\s+["']zod["']/g);

		expect(zodImports).toBeDefined();
		expect(zodImports).toHaveLength(1);
	});

	it("should have Zod import when generating enums in inferred mode", () => {
		const generator = new ZodSchemaGenerator({
			input: "tests/fixtures/type-mode.yaml",
			output: outputFile,
			typeMode: "inferred",
		});

		generator.generate();

		const content = readFileSync(outputFile, "utf-8");

		// Should have Zod import
		expect(content).toContain('import { z } from "zod"');

		// Should have enum schemas
		expect(content).toContain("userStatusSchema");
		expect(content).toContain('z.enum(["active", "inactive", "suspended"])');
	});

	it("should not have Zod import when all schemas are native", () => {
		const generator = new ZodSchemaGenerator({
			input: "tests/fixtures/type-mode.yaml",
			output: outputFile,
			typeMode: "native",
		});

		generator.generate();

		const content = readFileSync(outputFile, "utf-8");

		// Should NOT have Zod import
		expect(content).not.toContain('import { z } from "zod"');

		// Should have native enum types
		expect(content).toContain('export type UserStatus = "active" | "inactive" | "suspended"');
	});

	it("should have Zod import when mixing native and inferred modes", () => {
		const generator = new ZodSchemaGenerator({
			input: "tests/fixtures/type-mode.yaml",
			output: outputFile,
			request: {
				typeMode: "native",
			},
			response: {
				typeMode: "inferred",
			},
		});

		generator.generate();

		const content = readFileSync(outputFile, "utf-8");
		const zodImports = content.match(/import\s+{\s*z\s*}\s+from\s+["']zod["']/g);

		// Should have exactly one Zod import (for response schemas)
		expect(zodImports).toBeDefined();
		expect(zodImports).toHaveLength(1);

		// Should have both native types and Zod schemas
		expect(content).toContain("export type CreateUserRequest");
		expect(content).toContain("export const userSchema");
	});

	it("should have single Zod import even with multiple enum schemas", () => {
		const generator = new ZodSchemaGenerator({
			input: "tests/fixtures/composition.yaml",
			output: outputFile,
			typeMode: "inferred",
		});

		generator.generate();

		const content = readFileSync(outputFile, "utf-8");
		const zodImports = content.match(/import\s+{\s*z\s*}\s+from\s+["']zod["']/g);

		// Should have exactly one Zod import regardless of number of schemas
		expect(zodImports).toBeDefined();
		expect(zodImports).toHaveLength(1);
	});
});
