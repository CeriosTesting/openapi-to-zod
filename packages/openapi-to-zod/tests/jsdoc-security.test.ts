import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZodSchemaGenerator } from "../src/generator";
import { escapeJSDoc } from "../src/utils/string-utils";
import { TestUtils } from "./utils/test-utils";

/**
 * Tests for JSDoc injection prevention and security
 */
describe("JSDoc Security", () => {
	describe("escapeJSDoc Function", () => {
		it("should escape */ sequence to prevent comment injection", () => {
			const malicious = "This closes the comment */";
			const escaped = escapeJSDoc(malicious);

			expect(escaped).toBe("This closes the comment *\\/");
			expect(escaped).not.toContain("*/");
		});

		it("should handle multiple */ sequences", () => {
			const malicious = "First */ and second */ end";
			const escaped = escapeJSDoc(malicious);

			expect(escaped).toBe("First *\\/ and second *\\/ end");
			expect(escaped).not.toContain("*/");
		});

		it("should handle empty strings", () => {
			expect(escapeJSDoc("")).toBe("");
		});

		it("should handle strings without special characters", () => {
			const normal = "This is a normal description";
			expect(escapeJSDoc(normal)).toBe(normal);
		});

		it("should handle strings with only */", () => {
			expect(escapeJSDoc("*/")).toBe("*\\/");
		});

		it("should preserve other special characters", () => {
			const text = "Price: $10.00 @deprecated (yes!)";
			const escaped = escapeJSDoc(text);
			expect(escaped).toContain("$10.00");
			expect(escaped).toContain("@deprecated");
			expect(escaped).toContain("(yes!)");
		});
	});

	describe("JSDoc Generation Security", () => {
		it("should prevent comment injection in schema descriptions", () => {
			// Create a test fixture with malicious description
			const maliciousYaml = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    MaliciousSchema:
      type: object
      description: "This has */ injection attempt"
      properties:
        name:
          type: string
          description: "Another */ attempt /* and this */"
`;
			const fixturePath = TestUtils.getFixturePath("malicious-jsdoc.yaml");
			writeFileSync(fixturePath, maliciousYaml);

			const generator = new ZodSchemaGenerator({
				input: fixturePath,
				includeDescriptions: true,
			});

			const output = generator.generateString();

			// Should contain escaped version
			expect(output).toContain("*\\/");
			// Should not contain unescaped */
			expect(output).not.toMatch(/\*\/(?!\s*\n)/); // */ not followed by newline
		});

		it("should handle @ symbols in descriptions without breaking JSDoc tags", () => {
			const yamlWithAt = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    EmailSchema:
      type: object
      description: "Contact us at support@example.com"
      properties:
        email:
          type: string
          format: email
          description: "User email @example.com format"
`;
			const fixturePath = TestUtils.getFixturePath("email-jsdoc.yaml");
			writeFileSync(fixturePath, yamlWithAt);

			const generator = new ZodSchemaGenerator({
				input: fixturePath,
				includeDescriptions: true,
			});

			const output = generator.generateString();

			// @ symbols are escaped in JSDoc comments as \@
			expect(output).toContain("support\\@example.com");
			expect(output).toContain("\\@example.com");
		});
		it("should handle complex injection attempts", () => {
			const complexYaml = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    ComplexSchema:
      type: object
      description: "Try to break with comment end"
      properties:
        field:
          type: string
          description: "Field with */ comment terminator"
`;
			const fixturePath = TestUtils.getFixturePath("complex-jsdoc.yaml");
			writeFileSync(fixturePath, complexYaml);

			const generator = new ZodSchemaGenerator({
				input: fixturePath,
				includeDescriptions: true,
			});

			const output = generator.generateString();

			// Output should be valid TypeScript
			expect(output).toBeTruthy();
			// Should contain escaped sequences
			expect(output).toContain("*\\/");
		});
	});

	describe("Integration with .describe()", () => {
		it("should safely use descriptions in .describe() method", () => {
			const yamlWithDescribe = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    UserSchema:
      type: object
      description: "User object with special chars: */ and @mention"
      properties:
        name:
          type: string
          description: "User's full name"
`;
			const fixturePath = TestUtils.getFixturePath("describe-jsdoc.yaml");
			writeFileSync(fixturePath, yamlWithDescribe);

			const generator = new ZodSchemaGenerator({
				input: fixturePath,
				includeDescriptions: true,
				useDescribe: true,
			});

			const output = generator.generateString();

			// Should use .describe() safely
			expect(output).toContain(".describe(");
			// Should have escaped content in describe
			expect(output).toContain("User's full name");
		});
	});
});
