import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";
import type { GeneratorOptions } from "../src/types";

describe("Integration Tests", () => {
	const outputPath = "tests/output/integration.ts";
	const tempTestFile = "tests/output/integration-test.ts";

	afterEach(() => {
		[outputPath, tempTestFile].forEach(path => {
			if (existsSync(path)) {
				unlinkSync(path);
			}
		});
	});

	describe("TypeScript Compilation", () => {
		it("should generate TypeScript code that compiles without errors", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: outputPath,
				mode: "normal",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			// Try to compile with TypeScript
			expect(() => {
				execSync(`npx tsc --noEmit --skipLibCheck ${outputPath}`, {
					stdio: "pipe",
				});
			}).not.toThrow();
		}, 10000); // TypeScript compilation can be slow

		it("should generate valid TypeScript enums that compile", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/complex.yaml",
				output: outputPath,
				mode: "normal",
				enumType: "typescript",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			expect(() => {
				execSync(`npx tsc --noEmit --skipLibCheck ${outputPath}`, {
					stdio: "pipe",
				});
			}).not.toThrow();
		}, 10000);

		it("should generate circular references that compile", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/circular.yaml",
				output: outputPath,
				mode: "normal",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			expect(() => {
				execSync(`npx tsc --noEmit --skipLibCheck ${outputPath}`, {
					stdio: "pipe",
				});
			}).not.toThrow();
		}, 10000);
	});

	describe("Runtime Validation", () => {
		it("should generate schemas that can validate data", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: outputPath,
				mode: "normal",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			// Create a test file that imports and uses the schema
			const testCode = `
import { z } from 'zod';
${readFileSync(outputPath, "utf-8")}

const validUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test User',
};

const result = userSchema.safeParse(validUser);
if (!result.success) {
  throw new Error('Schema validation failed');
}
console.log('Validation passed');
`;

			writeFileSync(tempTestFile, testCode);

			// Compile and run
			execSync(`npx tsx ${tempTestFile}`, { stdio: "pipe" });
		});

		it("should reject invalid data", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/simple.yaml",
				output: outputPath,
				mode: "normal",
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			const testCode = `
import { z } from 'zod';
${readFileSync(outputPath, "utf-8")}

const invalidUser = {
  id: 'not-a-uuid',
  name: 'Test User',
};

const result = userSchema.safeParse(invalidUser);
if (result.success) {
  throw new Error('Schema should have failed validation');
}
console.log('Validation correctly failed');
`;

			writeFileSync(tempTestFile, testCode);
			execSync(`npx tsx ${tempTestFile}`, { stdio: "pipe" });
		});
	});

	describe("Full Pipeline", () => {
		it("should handle complete workflow from YAML to validated TypeScript", () => {
			const options: GeneratorOptions = {
				input: "tests/fixtures/complex.yaml",
				output: outputPath,
				mode: "normal",
				enumType: "zod",
				includeDescriptions: true,
			};

			const generator = new ZodSchemaGenerator(options);
			generator.generate();

			expect(existsSync(outputPath)).toBe(true);

			const output = readFileSync(outputPath, "utf-8");

			// Check all expected features are present
			expect(output).toContain('import { z } from "zod"');
			expect(output).toContain("export const");
			expect(output).toContain("export type");
			expect(output).toContain("z.infer<");

			// Verify it compiles
			expect(() => {
				execSync(`npx tsc --noEmit --skipLibCheck ${outputPath}`, {
					stdio: "pipe",
				});
			}).not.toThrow();
		});
	});
});
