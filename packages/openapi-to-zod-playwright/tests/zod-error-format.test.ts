// oxlint-disable typescript/no-unsafe-type-assertion
// oxlint-disable typescript/no-unsafe-assignment
// oxlint-disable typescript/no-unsafe-member-access
// oxlint-disable typescript/no-unsafe-call
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

const FIXTURES_DIR = resolve(__dirname, "fixtures");

describe("zodErrorFormat option", () => {
	describe("standard format (default)", () => {
		it("should use parseAsync for response validation by default", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
			});

			const serviceString = generator.generateServiceString();

			// Should use parseAsync for response validation
			expect(serviceString).toContain(".parseAsync(body)");
			// Should NOT contain prettify helper function imports
			expect(serviceString).not.toContain("parseWithPrettifyError");
			expect(serviceString).not.toContain("parseWithPrettifyErrorWithValues");
		});

		it("should use parseAsync for request validation with standard format", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "standard",
			});

			const serviceString = generator.generateServiceString();

			// Should use parseAsync for request validation
			expect(serviceString).toContain(".parseAsync(options.data)");
		});
	});

	describe("prettify format", () => {
		it("should import parseWithPrettifyError from package", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should import the helper from the package
			expect(serviceString).toContain('import { parseWithPrettifyError } from "@cerios/openapi-to-zod-playwright"');
		});

		it("should use parseWithPrettifyError for response validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should use the imported helper (no this. prefix)
			expect(serviceString).toContain("parseWithPrettifyError(");
			expect(serviceString).toContain(", body)");
			// Should NOT use this. prefix since it's imported
			expect(serviceString).not.toContain("this.parseWithPrettifyError(");
		});

		it("should use parseWithPrettifyError for request validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should use the imported helper for request validation
			expect(serviceString).toContain("parseWithPrettifyError(");
			expect(serviceString).toContain(", options.data)");
		});

		it("should NOT contain prettifyWithValues helper", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			expect(serviceString).not.toContain("parseWithPrettifyErrorWithValues");
		});
	});

	describe("prettifyWithValues format", () => {
		it("should import parseWithPrettifyErrorWithValues from package", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should import the helper from the package
			expect(serviceString).toContain(
				'import { parseWithPrettifyErrorWithValues } from "@cerios/openapi-to-zod-playwright"'
			);
		});

		it("should use parseWithPrettifyErrorWithValues for validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should use the imported helper
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues(");
		});

		it("should use parseWithPrettifyErrorWithValues for request validation", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should use the helper function for request validation
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues(");
			expect(serviceString).toContain(", options.data)");
		});

		it("should NOT contain simple prettify helper", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should only import prettifyWithValues, not the simple one
			expect(serviceString).not.toContain("import { parseWithPrettifyError }");
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues");
		});
	});

	describe("generated service file imports", () => {
		it("should NOT import z from zod when using prettify format with named inline schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				outputClient: resolve(FIXTURES_DIR, "../output/test-client.ts"),
				outputService: resolve(FIXTURES_DIR, "../output/test-service.ts"),
				zodErrorFormat: "prettify",
			});

			// Access private method for testing
			const serviceFile = (generator as any).generateServiceFile(
				resolve(FIXTURES_DIR, "../output/test-service.ts"),
				resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				resolve(FIXTURES_DIR, "../output/test-client.ts")
			);

			// z is NOT needed since inline schemas now use named schemas in the schemas file
			expect(serviceFile).not.toContain('import { z } from "zod"');
		});

		it("should NOT import z from zod when using prettifyWithValues format with named inline schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "simple-api.yaml"),
				outputTypes: resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				outputClient: resolve(FIXTURES_DIR, "../output/test-client.ts"),
				outputService: resolve(FIXTURES_DIR, "../output/test-service.ts"),
				zodErrorFormat: "prettifyWithValues",
			});

			// Access private method for testing
			const serviceFile = (generator as any).generateServiceFile(
				resolve(FIXTURES_DIR, "../output/test-service.ts"),
				resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				resolve(FIXTURES_DIR, "../output/test-client.ts")
			);

			// z is NOT needed since inline schemas now use named schemas in the schemas file
			expect(serviceFile).not.toContain('import { z } from "zod"');
		});

		it("should include runtime type imports (RequestBody, UrlEncodedFormData) alongside zodErrorFormat helpers", () => {
			// This test verifies the fix for the bug where RequestBody and other runtime types
			// were not imported when zodErrorFormat was set to prettify/prettifyWithValues
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "form-api.yaml"),
				outputTypes: resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				outputClient: resolve(FIXTURES_DIR, "../output/test-client.ts"),
				outputService: resolve(FIXTURES_DIR, "../output/test-service.ts"),
				zodErrorFormat: "prettify",
			});

			const serviceFile = (generator as any).generateServiceFile(
				resolve(FIXTURES_DIR, "../output/test-service.ts"),
				resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				resolve(FIXTURES_DIR, "../output/test-client.ts")
			);

			// Should have value import for the helper function
			expect(serviceFile).toContain('import { parseWithPrettifyError } from "@cerios/openapi-to-zod-playwright"');
			// Should have type import for runtime types (UrlEncodedFormData is used by form-api.yaml)
			expect(serviceFile).toContain("import type {");
			expect(serviceFile).toContain("UrlEncodedFormData");
			expect(serviceFile).toContain('} from "@cerios/openapi-to-zod-playwright"');
		});

		it("should include runtime type imports alongside prettifyWithValues helper", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "form-api.yaml"),
				outputTypes: resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				outputClient: resolve(FIXTURES_DIR, "../output/test-client.ts"),
				outputService: resolve(FIXTURES_DIR, "../output/test-service.ts"),
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceFile = (generator as any).generateServiceFile(
				resolve(FIXTURES_DIR, "../output/test-service.ts"),
				resolve(FIXTURES_DIR, "../output/test-schemas.ts"),
				resolve(FIXTURES_DIR, "../output/test-client.ts")
			);

			// Should have value import for the helper function
			expect(serviceFile).toContain(
				'import { parseWithPrettifyErrorWithValues } from "@cerios/openapi-to-zod-playwright"'
			);
			// Should have type import for runtime types
			expect(serviceFile).toContain("import type {");
			expect(serviceFile).toContain("UrlEncodedFormData");
			expect(serviceFile).toContain('} from "@cerios/openapi-to-zod-playwright"');
		});
	});

	describe("query and header parameter validation", () => {
		it("should use correct format for query param validation with prettify", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "query-params-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should use prettify helper for query params
			expect(serviceString).toContain("parseWithPrettifyError(");
			expect(serviceString).toContain("options.params)");
		});

		it("should use correct format for header param validation with prettifyWithValues", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "headers-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				validateServiceRequest: true,
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should use prettifyWithValues helper for headers
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues(");
			expect(serviceString).toContain("options.headers)");
		});
	});

	describe("inline schema validation", () => {
		it("should use correct format for inline schemas with prettify", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "inline-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettify",
			});

			const serviceString = generator.generateServiceString();

			// Should use prettify helper even for inline schemas
			expect(serviceString).toContain("parseWithPrettifyError(");
		});

		it("should use correct format for inline schemas with prettifyWithValues", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: resolve(FIXTURES_DIR, "inline-schema-api.yaml"),
				outputTypes: "output.ts",
				outputClient: "client.ts",
				zodErrorFormat: "prettifyWithValues",
			});

			const serviceString = generator.generateServiceString();

			// Should use prettifyWithValues helper for inline schemas
			expect(serviceString).toContain("parseWithPrettifyErrorWithValues(");
		});
	});

	describe("runtime helpers work correctly", () => {
		it("parseWithPrettifyError should throw formatted error on validation failure", async () => {
			const { parseWithPrettifyError } = await import("../src/runtime/zod-helpers");
			const { z } = await import("zod");

			const schema = z.object({ name: z.string(), age: z.number() });

			await expect(parseWithPrettifyError(schema, { name: 123, age: "invalid" })).rejects.toThrow();
		});

		it("parseWithPrettifyError should return data on success", async () => {
			const { parseWithPrettifyError } = await import("../src/runtime/zod-helpers");
			const { z } = await import("zod");

			const schema = z.object({ name: z.string(), age: z.number() });
			const result = await parseWithPrettifyError(schema, { name: "John", age: 30 });

			expect(result).toEqual({ name: "John", age: 30 });
		});

		it("parseWithPrettifyErrorWithValues should throw formatted error with values", async () => {
			const { parseWithPrettifyErrorWithValues } = await import("../src/runtime/zod-helpers");
			const { z } = await import("zod");

			// Use min() constraint - the error message won't contain "received"
			const schema = z.object({ age: z.number().min(0) });

			try {
				await parseWithPrettifyErrorWithValues(schema, { age: -5 });
				expect.fail("Should have thrown");
			} catch (error) {
				expect((error as Error).message).toContain("(received: -5)");
			}
		});

		it("formatZodErrorPath should format paths correctly", async () => {
			const { formatZodErrorPath } = await import("../src/runtime/zod-helpers");

			expect(formatZodErrorPath(["user", "name"])).toBe("user.name");
			expect(formatZodErrorPath(["items", 0, "value"])).toBe("items[0].value");
			expect(formatZodErrorPath([])).toBe("");
		});

		it("formatZodErrorWithValues should correctly resolve values at array paths", async () => {
			const { formatZodErrorWithValues } = await import("../src/runtime/zod-helpers");
			const { z } = await import("zod");

			// Schema expecting operation to be an object, not null
			const schema = z.object({
				data: z.array(
					z.object({
						id: z.string(),
						operation: z.object({ type: z.string() }),
					})
				),
			});

			const input = {
				data: [
					{
						id: "123",
						operation: null,
					},
				],
			};

			const result = schema.safeParse(input);
			expect(result.success).toBe(false);
			if (!result.success) {
				const formatted = formatZodErrorWithValues(result.error, input);
				// Should NOT contain "(received: undefined)" since it should resolve to null
				expect(formatted).not.toContain("(received: undefined)");
				// The message itself mentions "received null", so no extra received part
				expect(formatted).toContain("at data[0].operation");
			}
		});

		it("formatZodErrorWithValues should skip received part for unrecognized key errors", async () => {
			const { formatZodErrorWithValues } = await import("../src/runtime/zod-helpers");
			const { z } = await import("zod");

			// Schema with strict mode to reject extra keys
			const schema = z
				.object({
					id: z.string(),
				})
				.strict();

			const input = {
				id: "123",
				migrationKey: "extra",
			};

			const result = schema.safeParse(input);
			expect(result.success).toBe(false);
			if (!result.success) {
				const formatted = formatZodErrorWithValues(result.error, input);
				// Should NOT contain "(received:" for unrecognized key errors
				expect(formatted).not.toContain("(received:");
				expect(formatted).toContain("Unrecognized key");
			}
		});

		it("formatZodErrorWithValues should skip received part when message contains 'received'", async () => {
			const { formatZodErrorWithValues } = await import("../src/runtime/zod-helpers");
			const { z } = await import("zod");

			const schema = z.object({
				value: z.object({ type: z.string() }),
			});

			const input = { value: null };

			const result = schema.safeParse(input);
			expect(result.success).toBe(false);
			if (!result.success) {
				const formatted = formatZodErrorWithValues(result.error, input);
				// Message already says "received null", should not append extra "(received: ...)"
				expect(formatted).not.toContain("(received:");
			}
		});

		it("formatZodErrorWithValues should show received value when useful", async () => {
			const { formatZodErrorWithValues } = await import("../src/runtime/zod-helpers");
			const { z } = await import("zod");

			const schema = z.object({
				age: z.number().min(0),
			});

			const input = { age: -5 };

			const result = schema.safeParse(input);
			expect(result.success).toBe(false);
			if (!result.success) {
				const formatted = formatZodErrorWithValues(result.error, input);
				// Should show the actual invalid value
				expect(formatted).toContain("(received: -5)");
			}
		});

		it("formatZodErrorWithValues should handle nested array structure", async () => {
			const { formatZodErrorWithValues } = await import("../src/runtime/zod-helpers");
			const { z } = await import("zod");

			// Use min() constraint so the error message won't contain "received"
			const schema = z.object({
				data: z.array(
					z.array(
						z.object({
							value: z.number().min(0),
						})
					)
				),
			});

			const input = {
				data: [[{ value: -10 }]],
			};

			const result = schema.safeParse(input);
			expect(result.success).toBe(false);
			if (!result.success) {
				const formatted = formatZodErrorWithValues(result.error, input);
				// Should correctly resolve value through nested arrays
				expect(formatted).toContain("(received: -10)");
				expect(formatted).toContain("at data[0][0].value");
			}
		});
	});
});
