import { existsSync, rmSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("allOf warning deduplication", () => {
	const fixtureFile = TestUtils.getZodFixturePath("edge-case-improvements.yaml");
	const outputTypes = TestUtils.getOutputPath("dedupe-schemas.ts");
	const outputClient = TestUtils.getOutputPath("dedupe-client.ts");
	const outputService = TestUtils.getOutputPath("dedupe-service.ts");

	afterEach(() => {
		for (const filePath of [outputTypes, outputClient, outputService]) {
			if (existsSync(filePath)) {
				rmSync(filePath, { force: true });
			}
		}
	});

	it("should not re-emit identical allOf conflict warnings during generate()", () => {
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		try {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				outputTypes,
				outputClient,
				outputService,
			});

			generator.generate();

			const targetConflict = 'Property "name" has conflicting definitions in BaseWithName and inline';
			const allOfConflictMessages = consoleWarnSpy.mock.calls
				.map((call: unknown[]) => call[0])
				.filter((msg: unknown) => typeof msg === "string" && msg.includes("allOf composition conflict")) as string[];

			const targetMessageCount = allOfConflictMessages.filter(msg => msg.includes(targetConflict)).length;
			expect(targetMessageCount).toBe(1);
		} finally {
			consoleWarnSpy.mockRestore();
		}
	});
});
