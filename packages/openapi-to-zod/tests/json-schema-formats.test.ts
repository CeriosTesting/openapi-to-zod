import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import { TestUtils } from "./utils/test-utils";

describe("JSON Schema Formats", () => {
	const outputPath = TestUtils.getOutputPath("json-schema-formats.ts");

	describe("JSON Pointer Format", () => {
		it("should generate validation for json-pointer format", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("json-schema-formats.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toMatch(/JSON Pointer.*RFC 6901/);
			expect(output).toMatch(/refine.*JSON Pointer/);
		});

		it("should validate JSON Pointer format", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("json-schema-formats.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { jsonPointerExampleSchema } = await import(outputPath);

			// Valid JSON Pointers (RFC 6901)
			expect(() => jsonPointerExampleSchema.parse({ pointer: "" })).not.toThrow(); // Empty string is valid
			expect(() => jsonPointerExampleSchema.parse({ pointer: "/foo" })).not.toThrow();
			expect(() => jsonPointerExampleSchema.parse({ pointer: "/foo/bar" })).not.toThrow();
			expect(() => jsonPointerExampleSchema.parse({ pointer: "/foo/0" })).not.toThrow();
			expect(() => jsonPointerExampleSchema.parse({ pointer: "/foo~0bar" })).not.toThrow(); // ~0 encodes ~
			expect(() => jsonPointerExampleSchema.parse({ pointer: "/foo~1bar" })).not.toThrow(); // ~1 encodes /

			// Invalid JSON Pointers
			expect(() => jsonPointerExampleSchema.parse({ pointer: "foo" })).toThrow(); // Missing leading /
			expect(() => jsonPointerExampleSchema.parse({ pointer: "/foo~" })).toThrow(); // Invalid escape
			expect(() => jsonPointerExampleSchema.parse({ pointer: "/foo~2" })).toThrow(); // Invalid escape sequence
		});
	});

	describe("Relative JSON Pointer Format", () => {
		it("should generate validation for relative-json-pointer format", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("json-schema-formats.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toMatch(/Relative JSON Pointer/);
			expect(output).toMatch(/refine.*relative JSON Pointer/);
		});

		it("should validate relative JSON Pointer format", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("json-schema-formats.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { relativeJsonPointerExampleSchema } = await import(outputPath);

			// Valid relative JSON Pointers
			expect(() => relativeJsonPointerExampleSchema.parse({ relativePointer: "0" })).not.toThrow();
			expect(() => relativeJsonPointerExampleSchema.parse({ relativePointer: "1/foo" })).not.toThrow();
			expect(() => relativeJsonPointerExampleSchema.parse({ relativePointer: "2/bar/baz" })).not.toThrow();
			expect(() => relativeJsonPointerExampleSchema.parse({ relativePointer: "0#" })).not.toThrow();
			expect(() => relativeJsonPointerExampleSchema.parse({ relativePointer: "1#" })).not.toThrow();

			// Invalid relative JSON Pointers
			expect(() => relativeJsonPointerExampleSchema.parse({ relativePointer: "" })).toThrow(); // Empty
			expect(() => relativeJsonPointerExampleSchema.parse({ relativePointer: "/foo" })).toThrow(); // Absolute pointer
			expect(() => relativeJsonPointerExampleSchema.parse({ relativePointer: "foo" })).toThrow(); // Missing number
			expect(() => relativeJsonPointerExampleSchema.parse({ relativePointer: "-1/foo" })).toThrow(); // Negative number
		});
	});

	describe("Enhanced Duration Format", () => {
		it("should generate validation for duration format with full ISO 8601 support", () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("json-schema-formats.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const output = readFileSync(outputPath, "utf-8");
			expect(output).toContain("duration");
			expect(output).toMatch(/refine.*ISO 8601 duration/);
		});

		it("should validate ISO 8601 duration format", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("json-schema-formats.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { durationExampleSchema } = await import(outputPath);

			// Valid ISO 8601 durations
			expect(() => durationExampleSchema.parse({ period: "P1Y" })).not.toThrow();
			expect(() => durationExampleSchema.parse({ period: "P3Y6M4D" })).not.toThrow();
			expect(() => durationExampleSchema.parse({ period: "PT12H30M" })).not.toThrow();
			expect(() => durationExampleSchema.parse({ period: "P1DT12H" })).not.toThrow();
			expect(() => durationExampleSchema.parse({ period: "PT1M30S" })).not.toThrow();
			expect(() => durationExampleSchema.parse({ period: "PT0.5S" })).not.toThrow(); // Fractional seconds
			expect(() => durationExampleSchema.parse({ period: "P1W" })).not.toThrow(); // Week

			// Invalid durations
			expect(() => durationExampleSchema.parse({ period: "P" })).toThrow(); // Empty duration
			expect(() => durationExampleSchema.parse({ period: "1Y" })).toThrow(); // Missing P
			expect(() => durationExampleSchema.parse({ period: "PT" })).toThrow(); // T without time components
			expect(() => durationExampleSchema.parse({ period: "P1Y2W" })).toThrow(); // Weeks can't mix with years
			expect(() => durationExampleSchema.parse({ period: "P3W2D" })).toThrow(); // Weeks can't mix with days
		});
	});

	describe("All Formats Combined", () => {
		it("should handle all new formats in one schema", async () => {
			const generator = new OpenApiGenerator({
				input: TestUtils.getFixturePath("json-schema-formats.yaml"),
				output: outputPath,
				mode: "normal",
				showStats: false,
			});

			generator.generate();

			const { allFormatsExampleSchema } = await import(outputPath);

			const validData = {
				jsonPointer: "/foo/bar",
				relativeJsonPointer: "1/baz",
				duration: "P1Y2M3DT4H5M6S",
			};

			expect(() => allFormatsExampleSchema.parse(validData)).not.toThrow();

			const invalidPointer = {
				jsonPointer: "foo", // Missing leading /
				relativeJsonPointer: "1/baz",
				duration: "P1Y",
			};
			expect(() => allFormatsExampleSchema.parse(invalidPointer)).toThrow();
		});
	});
});
