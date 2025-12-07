import { afterEach, describe, expect, it } from "vitest";
import { cleanupTestOutput, generateFromFixture } from "./utils/test-utils";

describe("Discriminator Mapping", () => {
	const outputPath = "tests/output/discriminator-mapping.ts";

	afterEach(cleanupTestOutput(outputPath));

	it("should generate discriminated union with mapping", () => {
		const output = generateFromFixture({
			fixture: "discriminator-mapping.yaml",
			outputPath,
		});

		// Should have discriminated union
		expect(output).toContain("petSchema");
		expect(output).toContain('z.discriminatedUnion("petType"');
		expect(output).toContain("dogSchema");
		expect(output).toContain("catSchema");
		expect(output).toContain("birdSchema");
	});

	it("should define schemas before using in discriminated union", () => {
		const output = generateFromFixture({
			fixture: "discriminator-mapping.yaml",
			outputPath,
		});

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
		const output = generateFromFixture({
			fixture: "discriminator-mapping.yaml",
			outputPath,
		});

		// Vehicle should use discriminated union
		expect(output).toContain("vehicleSchema");
		expect(output).toContain('z.discriminatedUnion("vehicleType"');
		expect(output).toContain("carSchema");
		expect(output).toContain("truckSchema");
	});

	it("should generate const values for discriminator properties", () => {
		const output = generateFromFixture({
			fixture: "discriminator-mapping.yaml",
			outputPath,
		});

		// Should have const literals for discriminator values
		expect(output).toContain('z.literal("dog")');
		expect(output).toContain('z.literal("cat")');
		expect(output).toContain('z.literal("bird")');
		expect(output).toContain('z.literal("car")');
		expect(output).toContain('z.literal("truck")');
	});
});
