import { describe, expect, it } from "vitest";
import { OpenApiGenerator } from "../src/openapi-generator";
import type { OpenApiGeneratorOptions } from "../src/types";
import { TestUtils } from "./utils/test-utils";

describe("Discriminator Mapping", () => {
	function generateOutput(options?: Partial<OpenApiGeneratorOptions>): string {
		const generator = new OpenApiGenerator({
			input: TestUtils.getFixturePath("discriminator-mapping.yaml"),
			output: "output.ts",
			...options,
		});
		return generator.generateString();
	}

	it("should generate discriminated union with mapping", () => {
		const output = generateOutput();

		// Should have discriminated union
		expect(output).toContain("petSchema");
		expect(output).toContain('z.discriminatedUnion("petType"');
		expect(output).toContain("dogSchema");
		expect(output).toContain("catSchema");
		expect(output).toContain("birdSchema");
	});

	it("should define schemas before using in discriminated union", () => {
		const output = generateOutput();

		// Dog, Cat, Bird should be defined before Pet
		const dogIndex = output.indexOf("const dogSchema");
		const catIndex = output.indexOf("const catSchema");
		const birdIndex = output.indexOf("const birdSchema");
		const petIndex = output.indexOf("const petSchema");

		expect(dogIndex).toBeGreaterThan(0);
		expect(catIndex).toBeGreaterThan(0);
		expect(birdIndex).toBeGreaterThan(0);
		expect(petIndex).toBeGreaterThan(0);

		// Pet should come after its constituent schemas
		expect(petIndex).toBeGreaterThan(dogIndex);
		expect(petIndex).toBeGreaterThan(catIndex);
		expect(petIndex).toBeGreaterThan(birdIndex);
	});

	it("should handle anyOf with discriminator mapping", () => {
		const output = generateOutput();

		// Vehicle should use discriminated union
		expect(output).toContain("vehicleSchema");
		expect(output).toContain('z.discriminatedUnion("vehicleType"');
		expect(output).toContain("carSchema");
		expect(output).toContain("truckSchema");
	});

	it("should generate const values for discriminator properties", () => {
		const output = generateOutput();

		// Should have const literals for discriminator values
		expect(output).toContain('z.literal("dog")');
		expect(output).toContain('z.literal("cat")');
		expect(output).toContain('z.literal("bird")');
		expect(output).toContain('z.literal("car")');
		expect(output).toContain('z.literal("truck")');
	});
});
