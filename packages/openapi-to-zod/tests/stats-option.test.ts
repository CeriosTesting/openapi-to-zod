import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Stats Option", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("simple.yaml"),
			mode: "normal",
			...options,
		});
		return generator.generateString();
	}

	it("should include statistics when showStats is true", () => {
		const output = generateOutput({ showStats: true });
		expect(output).toContain("// Generation Statistics:");
	});

	it("should exclude statistics when showStats is false", () => {
		const output = generateOutput({ showStats: false });
		expect(output).not.toContain("// Generation Statistics:");
	});

	it("should include statistics by default (when showStats is undefined)", () => {
		const output = generateOutput();
		expect(output).toContain("// Generation Statistics:");
	});

	it("should exclude statistics when showStats is explicitly false vs undefined", () => {
		// Test with false
		const output1 = generateOutput({ showStats: false });
		expect(output1).not.toContain("// Generation Statistics:");

		// Test with undefined (default)
		const output2 = generateOutput();
		expect(output2).toContain("// Generation Statistics:");
	});
});
