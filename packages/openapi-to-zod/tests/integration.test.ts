import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";

import { TestUtils } from "./utils/test-utils";

describe("Integration Tests", () => {
	const outputPath = TestUtils.getOutputPath("integration.ts");

	describe("TypeScript Compilation", () => {
		it("should generate TypeScript code that compiles without errors", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: outputPath,
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			generator.generate();

			// Try to compile with TypeScript
			expect(() => {
				execSync(`npx tsc --noEmit --skipLibCheck ${outputPath}`, {
					stdio: "pipe",
				});
			}).not.toThrow();
		}, 10000); // TypeScript compilation can be slow

		it("should generate circular references that compile", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getCoreFixturePath("references", "circular.yaml"),
				outputTypes: outputPath,
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			generator.generate();

			expect(() => {
				execSync(`npx tsc --noEmit --skipLibCheck ${outputPath}`, {
					stdio: "pipe",
				});
			}).not.toThrow();
		}, 10000);
	});

	describe("Runtime Validation", () => {
		it("should generate schemas that can validate data", async () => {
			const validationPath = TestUtils.getOutputPath("integration-validation.ts");

			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: validationPath,
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			generator.generate();

			// Dynamically import the generated schema
			const module = await import(`file://${validationPath}`);
			const { userSchema } = module;

			const validUser = {
				id: "123e4567-e89b-12d3-a456-426614174000",
				name: "Test User",
			};

			const result = userSchema.safeParse(validUser);
			expect(result.success).toBe(true);
		});

		it("should reject invalid data", async () => {
			const rejectionPath = TestUtils.getOutputPath("integration-rejection.ts");

			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("simple.yaml"),
				outputTypes: rejectionPath,
				mode: "normal",
			};

			const generator = new OpenApiGenerator(options);
			generator.generate();

			// Dynamically import the generated schema
			const module = await import(`file://${rejectionPath}`);
			const { userSchema } = module;

			const invalidUser = {
				id: "not-a-uuid",
				name: "Test User",
			};

			const result = userSchema.safeParse(invalidUser);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues).toBeDefined();
				expect(result.error.issues.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Full Pipeline", () => {
		it("should handle complete workflow from YAML to validated TypeScript", () => {
			const options: OpenApiGeneratorOptions = {
				input: TestUtils.getFixturePath("complex.yaml"),
				outputTypes: outputPath,
				mode: "normal",
				includeDescriptions: true,
			};

			const generator = new OpenApiGenerator(options);
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
