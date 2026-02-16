import { describe, expect, it } from "vitest";
import { z } from "zod";

import { formatConfigValidationError } from "../src/utils/config-validation";

describe("config-validation", () => {
	describe("formatConfigValidationError", () => {
		it("should format a single validation error", () => {
			const schema = z.object({
				input: z.string(),
				output: z.string(),
			});

			const result = schema.safeParse({ input: 123 });
			expect(result.success).toBe(false);

			if (!result.success) {
				const message = formatConfigValidationError(result.error, "/path/to/config.yaml", undefined);

				expect(message).toContain("Invalid configuration file at: /path/to/config.yaml");
				expect(message).toContain("Validation errors:");
				expect(message).toContain("input:");
			}
		});

		it("should format multiple validation errors", () => {
			const schema = z.object({
				input: z.string(),
				output: z.string(),
				mode: z.enum(["strict", "normal", "loose"]),
			});

			const result = schema.safeParse({ input: 123, mode: "invalid" });
			expect(result.success).toBe(false);

			if (!result.success) {
				const message = formatConfigValidationError(result.error, "/path/to/config.yaml", undefined);

				expect(message).toContain("input:");
				expect(message).toContain("mode:");
			}
		});

		it("should use configPath when filepath is undefined", () => {
			const schema = z.object({ input: z.string() });
			const result = schema.safeParse({});

			if (!result.success) {
				const message = formatConfigValidationError(result.error, undefined, "/custom/config.yaml");

				expect(message).toContain("Invalid configuration file at: /custom/config.yaml");
			}
		});

		it("should fallback to 'config file' when both paths are undefined", () => {
			const schema = z.object({ input: z.string() });
			const result = schema.safeParse({});

			if (!result.success) {
				const message = formatConfigValidationError(result.error, undefined, undefined);

				expect(message).toContain("Invalid configuration file at: config file");
			}
		});

		it("should format nested path errors correctly", () => {
			const schema = z.object({
				specs: z.array(
					z.object({
						input: z.string(),
						output: z.string(),
					})
				),
			});

			const result = schema.safeParse({
				specs: [{ input: 123, output: "valid" }],
			});

			if (!result.success) {
				const message = formatConfigValidationError(result.error, "/config.yaml", undefined);

				expect(message).toContain("specs.0.input:");
			}
		});

		it("should include additional notes when provided", () => {
			const schema = z.object({ input: z.string() });
			const result = schema.safeParse({});

			if (!result.success) {
				const message = formatConfigValidationError(result.error, "/config.yaml", undefined, {
					additionalNotes: ["Check the documentation for valid options", "Run with --help for more information"],
				});

				expect(message).toContain("Check the documentation for valid options");
				expect(message).toContain("Run with --help for more information");
			}
		});

		it("should include helpful guidance messages", () => {
			const schema = z.object({ input: z.string() });
			const result = schema.safeParse({});

			if (!result.success) {
				const message = formatConfigValidationError(result.error, "/config.yaml", undefined);

				expect(message).toContain("Please check your configuration file and ensure:");
				expect(message).toContain("All required fields are present");
				expect(message).toContain("Field names are spelled correctly");
				expect(message).toContain("Values match the expected types");
			}
		});

		it("should handle root-level validation errors", () => {
			const schema = z.string();
			const result = schema.safeParse(123);

			if (!result.success) {
				const message = formatConfigValidationError(result.error, "/config.yaml", undefined);

				expect(message).toContain("root:");
			}
		});

		it("should prefer filepath over configPath", () => {
			const schema = z.object({ input: z.string() });
			const result = schema.safeParse({});

			if (!result.success) {
				const message = formatConfigValidationError(result.error, "/primary/path.yaml", "/fallback/path.yaml");

				expect(message).toContain("Invalid configuration file at: /primary/path.yaml");
				expect(message).not.toContain("/fallback/path.yaml");
			}
		});
	});
});
