import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import { TestUtils } from "./utils/test-utils";

describe("MIME and URL Patterns with Forward Slashes", () => {
	const outputPath = TestUtils.getOutputPath("mime-patterns.ts");

	function generateOutput(): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("mime-patterns.yaml"),
			output: outputPath,
			mode: "normal",
			showStats: false,
		});
		return generator.generateString();
	}

	describe("Pattern Escaping", () => {
		it("should correctly escape MIME type pattern", () => {
			const output = generateOutput();

			// The pattern ^\w+\/[-+.\w]+$ should become /^\w+\/[-+.\w]+$/
			// Check that forward slash is escaped once, not twice
			expect(output).toContain("mimetype:");
			expect(output).toMatch(/mimetype:.*\.regex\(/);

			// Should NOT have double-backslash before forward slash (\\/)
			expect(output).not.toContain("\\\\/[-+");
		});

		it("should correctly escape URL pattern with protocol", () => {
			const output = generateOutput();

			// Pattern ^https?:\/\/[\w.-]+(\/[\w.\/-]*)?$ should be properly escaped
			expect(output).toContain("url:");
			expect(output).toMatch(/url:.*\.regex\(/);
		});

		it("should correctly escape API path pattern", () => {
			const output = generateOutput();

			// Pattern ^\/api\/v\d+\/[\w\/]+$ should be properly escaped
			expect(output).toContain("path:");
			expect(output).toMatch(/path:.*\.regex\(/);
		});
	});

	describe("Generated Schema Validation", () => {
		it("should validate MIME types correctly", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("mime-patterns.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { attachmentSchema } = await import(outputPath);

			// Valid MIME types
			expect(() => attachmentSchema.parse({ mimetype: "text/plain" })).not.toThrow();
			expect(() => attachmentSchema.parse({ mimetype: "application/json" })).not.toThrow();
			expect(() => attachmentSchema.parse({ mimetype: "image/png" })).not.toThrow();
			expect(() => attachmentSchema.parse({ mimetype: "application/vnd.api+json" })).not.toThrow();

			// Invalid MIME types
			expect(() => attachmentSchema.parse({ mimetype: "invalid" })).toThrow();
			expect(() => attachmentSchema.parse({ mimetype: "/plain" })).toThrow();
			expect(() => attachmentSchema.parse({ mimetype: "text/" })).toThrow();
		});

		it("should validate media file URLs correctly", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("mime-patterns.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { mediaFileSchema } = await import(outputPath);

			// Valid media types and URLs
			expect(() =>
				mediaFileSchema.parse({
					type: "image/png",
					url: "https://example.com/image.png",
				})
			).not.toThrow();

			expect(() =>
				mediaFileSchema.parse({
					type: "video/mp4",
					url: "http://cdn.example.com/videos/test.mp4",
				})
			).not.toThrow();

			// Invalid media type (not image/video/audio)
			expect(() =>
				mediaFileSchema.parse({
					type: "text/plain",
					url: "https://example.com/file.txt",
				})
			).toThrow();
		});

		it("should validate API endpoint paths correctly", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("mime-patterns.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { apiEndpointSchema } = await import(outputPath);

			// Valid API paths
			expect(() => apiEndpointSchema.parse({ path: "/api/v1/users" })).not.toThrow();
			expect(() => apiEndpointSchema.parse({ path: "/api/v2/posts/comments" })).not.toThrow();

			// Invalid paths
			expect(() => apiEndpointSchema.parse({ path: "api/v1/users" })).toThrow(); // No leading slash
			expect(() => apiEndpointSchema.parse({ path: "/api/users" })).toThrow(); // No version
		});
	});

	describe("Output Code Validity", () => {
		it("should generate syntactically valid TypeScript", () => {
			const output = generateOutput();

			// All regex patterns should be valid (no syntax errors)
			const regexMatches = output.matchAll(/\.regex\(\/(.+?)\/\)/g);

			for (const match of regexMatches) {
				const pattern = match[1];
				// Verify each pattern can be compiled as a regex
				expect(() => new RegExp(pattern), `Pattern "${pattern}" should be valid`).not.toThrow();
			}
		});

		it("should not have any double-escaped forward slashes in patterns", () => {
			const output = generateOutput();

			// Look for patterns like \\\/ which indicate double-escaping
			// This would make the regex invalid
			const problematicPattern = /\.regex\(\/[^/]*\\\\\/[^/]*\/\)/;
			expect(output).not.toMatch(problematicPattern);
		});
	});
});
