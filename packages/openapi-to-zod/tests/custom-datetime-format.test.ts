import { afterEach, describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { resetFormatMap } from "../src/validators/string-validator";

/**
 * Tests for customDateTimeFormatRegex option
 * Validates that users can override the default z.iso.datetime() validation
 * with custom regex patterns for date-time format fields
 */
describe("Custom DateTime Format", () => {
	afterEach(() => {
		// Reset format map after each test to avoid pollution between tests
		resetFormatMap();
	});

	/**
	 * Helper function to generate output from a minimal OpenAPI spec
	 */
	function generateFromSpec(spec: string, options?: Partial<Omit<OpenApiGeneratorOptions, "input">>): string {
		// Create a temporary spec with date-time field
		const tempSpec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    TestSchema:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
          description: A timestamp field
        name:
          type: string
`;

		// Write temp spec and generate
		const fs = require("node:fs");
		const path = require("node:path");
		const tempDir = path.join(__dirname, "output", "temp");
		const tempFile = path.join(tempDir, `test-spec-${Date.now()}.yaml`);

		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(tempFile, spec || tempSpec, "utf-8");

		try {
			const generator = new OpenApiGenerator({
				input: tempFile,
				output: "output.ts",
				...options,
			});
			return generator.generateString();
		} finally {
			// Cleanup
			fs.unlinkSync(tempFile);
		}
	}

	describe("Default Behavior", () => {
		it("should use z.iso.datetime() when no custom format specified", () => {
			const output = generateFromSpec("");

			expect(output).toContain("z.iso.datetime()");
			expect(output).not.toContain("z.string().regex(");
		});

		it("should include description even with default format", () => {
			const output = generateFromSpec("", {
				useDescribe: true,
			});

			expect(output).toContain("z.iso.datetime()");
			expect(output).toContain(".describe(");
		});
	});

	describe("String Pattern (JSON/YAML config format)", () => {
		it("should use custom regex pattern for date-time without Z suffix", () => {
			const customPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$";
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: customPattern,
			});

			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$/");
			expect(output).not.toContain("z.iso.datetime()");
		});

		it("should use custom regex pattern with milliseconds", () => {
			const customPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}$";
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: customPattern,
			});

			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}$/");
			expect(output).not.toContain("z.iso.datetime()");
		});

		it("should use custom regex pattern with optional Z suffix", () => {
			const customPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z?$";
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: customPattern,
			});

			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z?$/");
			expect(output).not.toContain("z.iso.datetime()");
		});

		it("should properly escape special regex characters in pattern", () => {
			// Test with pattern containing special characters that need escaping
			const customPattern = "^\\d{4}-\\d{2}";
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: customPattern,
			});

			// Should escape properly for Zod
			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}/");
		});
	});

	describe("RegExp Literal (TypeScript config format)", () => {
		it("should accept RegExp object and convert to pattern", () => {
			const customPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: customPattern,
			});

			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$/");
			expect(output).not.toContain("z.iso.datetime()");
		});

		it("should handle RegExp with flags (though not recommended for date-time)", () => {
			// Even if flags are provided in RegExp, only the source pattern is used
			const customPattern = /^\d{4}-\d{2}-\d{2}$/i;
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: customPattern,
			});

			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/");
		});
	});

	describe("Multiple Schemas", () => {
		it("should apply custom format to all date-time fields in spec", () => {
			const spec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    EventSchema:
      type: object
      properties:
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    UserSchema:
      type: object
      properties:
        lastLogin:
          type: string
          format: date-time
`;

			const customPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$";
			const output = generateFromSpec(spec, {
				customDateTimeFormatRegex: customPattern,
			});

			// All date-time fields should use custom format
			const regexMatches = output.match(/z\.string\(\)\.regex\(/g);
			expect(regexMatches).toBeTruthy();
			expect(regexMatches?.length).toBe(3); // createdAt, updatedAt, lastLogin

			// No default z.iso.datetime() should remain
			expect(output).not.toContain("z.iso.datetime()");
		});
	});

	describe("Other String Formats", () => {
		it("should not affect other string formats (date, email, uuid, etc.)", () => {
			const spec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    MixedFormats:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
        email:
          type: string
          format: email
        uuid:
          type: string
          format: uuid
        birthDate:
          type: string
          format: date
`;

			const customPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$";
			const output = generateFromSpec(spec, {
				customDateTimeFormatRegex: customPattern,
			});

			// date-time uses custom format
			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$/");

			// Other formats remain unchanged
			expect(output).toContain("z.email()");
			expect(output).toContain("z.uuid()");
			expect(output).toContain("z.iso.date()"); // date format still uses default
		});
	});

	describe("Integration with Other Options", () => {
		it("should work with useDescribe option", () => {
			const spec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    TestSchema:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
          description: Creation timestamp
`;

			const customPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$";
			const output = generateFromSpec(spec, {
				customDateTimeFormatRegex: customPattern,
				useDescribe: true,
			});

			// Should have both custom regex and description
			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$/");
			expect(output).toContain(".describe(");
			expect(output).toContain("Creation timestamp");
		});

		it("should work with validation mode options", () => {
			const customPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$";
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: customPattern,
				mode: "strict",
			});

			// Should still use custom format regardless of validation mode
			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$/");
			expect(output).toContain("z.strictObject(");
		});

		it("should work with includeDescriptions option", () => {
			const spec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
components:
  schemas:
    TestSchema:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
          description: Creation timestamp
`;

			const customPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$";
			const output = generateFromSpec(spec, {
				customDateTimeFormatRegex: customPattern,
				includeDescriptions: true,
			});

			// Should have JSDoc comment with description
			expect(output).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$/");
			expect(output).toContain("* Creation timestamp");
		});
	});

	describe("Error Handling", () => {
		it("should throw error for invalid regex pattern with unclosed bracket", () => {
			const invalidPattern = "^[unclosed"; // Invalid regex - unclosed bracket

			expect(() => {
				generateFromSpec("", {
					customDateTimeFormatRegex: invalidPattern,
				});
			}).toThrow(/invalid regular expression|unterminated character class/i);
		});

		it("should throw error for malformed regex pattern with invalid group", () => {
			const malformedPattern = "(?invalid)"; // Invalid group syntax

			expect(() => {
				generateFromSpec("", {
					customDateTimeFormatRegex: malformedPattern,
				});
			}).toThrow(/invalid regular expression|invalid group/i);
		});

		it("should throw error for regex with malformed quantifier", () => {
			const badPattern = "^\\d{4,2}"; // Malformed quantifier - min > max

			expect(() => {
				generateFromSpec("", {
					customDateTimeFormatRegex: badPattern,
				});
			}).toThrow(/invalid regular expression|numbers out of order/i);
		});

		it("should throw error for regex with unmatched parenthesis", () => {
			const unmatchedPattern = "^(\\d{4}"; // Unmatched opening parenthesis

			expect(() => {
				generateFromSpec("", {
					customDateTimeFormatRegex: unmatchedPattern,
				});
			}).toThrow(/invalid regular expression|unmatched|unterminated group/i);
		});

		it("should include helpful error message with pattern details", () => {
			const invalidPattern = "^[unclosed";

			try {
				generateFromSpec("", {
					customDateTimeFormatRegex: invalidPattern,
				});
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("customDateTimeFormatRegex");
				expect(error.message).toContain(invalidPattern);
			}
		});

		it("should handle empty string pattern gracefully", () => {
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: "",
			});

			// Empty pattern should reset to default
			expect(output).toContain("z.iso.datetime()");
			expect(output).not.toContain("z.string().regex(");
		});

		it("should throw error for RegExp with invalid pattern", () => {
			// This will throw during RegExp construction
			expect(() => {
				// biome-ignore lint/complexity/useRegexLiterals: <testing purpose>
				new RegExp("[unclosed");
			}).toThrow(/invalid|unterminated/i);
		});
	});

	describe("Edge Cases", () => {
		it("should handle very complex regex patterns", () => {
			// Complex pattern with optional milliseconds and timezone
			const complexPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,6})?(Z|[+-]\\d{2}:\\d{2})?$";
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: complexPattern,
			});

			expect(output).toContain("z.string().regex(");
			expect(output).not.toContain("z.iso.datetime()");
		});

		it("should handle patterns with forward slashes (requires escaping)", () => {
			// Pattern with forward slashes that need escaping in regex literal
			const patternWithSlashes = "^\\d{4}/\\d{2}/\\d{2}$";
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: patternWithSlashes,
			});

			// Should escape forward slashes
			expect(output).toContain("z.string().regex(/^\\d{4}\\/\\d{2}\\/\\d{2}$/");
		});

		it("should handle patterns with special regex metacharacters", () => {
			const specialChars = "^\\d+\\.\\d+$"; // Dot needs escaping
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: specialChars,
			});

			expect(output).toContain("z.string().regex(/^\\d+\\.\\d+$/");
		});

		it("should handle very long patterns", () => {
			// Very long pattern (but valid)
			const longPattern = `^${"\\d".repeat(50)}$`;
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: longPattern,
			});

			expect(output).toContain("z.string().regex(");
		});

		it("should handle patterns with unicode characters", () => {
			// Pattern with unicode escape sequences
			const unicodePattern = "^[\\u0000-\\uFFFF]+$";
			const output = generateFromSpec("", {
				customDateTimeFormatRegex: unicodePattern,
			});

			expect(output).toContain("z.string().regex(/^[\\u0000-\\uFFFF]+$/");
		});
	});

	describe("Format Map Reset", () => {
		it("should reset to default after calling resetFormatMap()", () => {
			// First, set a custom format
			const customPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$";
			const output1 = generateFromSpec("", {
				customDateTimeFormatRegex: customPattern,
			});

			expect(output1).toContain("z.string().regex(");
			expect(output1).not.toContain("z.iso.datetime()");

			// Reset
			resetFormatMap();

			// Generate again without custom format
			const output2 = generateFromSpec("");

			// Should use default again
			expect(output2).toContain("z.iso.datetime()");
			expect(output2).not.toContain("z.string().regex(");
		});

		it("should allow switching between different custom patterns", () => {
			// First pattern
			const pattern1 = "^\\d{4}-\\d{2}-\\d{2}$";
			const output1 = generateFromSpec("", {
				customDateTimeFormatRegex: pattern1,
			});
			expect(output1).toContain("z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/");

			// Reset and use different pattern
			resetFormatMap();

			const pattern2 = "^\\d{2}/\\d{2}/\\d{4}$";
			const output2 = generateFromSpec("", {
				customDateTimeFormatRegex: pattern2,
			});
			expect(output2).toContain("z.string().regex(/^\\d{2}\\/\\d{2}\\/\\d{4}$/");
			expect(output2).not.toContain(pattern1);
		});
	});
});
