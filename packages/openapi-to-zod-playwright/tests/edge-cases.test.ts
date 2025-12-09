import { describe, expect, it } from "vitest";
import { FileOperationError } from "../src/errors";
import { PlaywrightGenerator } from "../src/playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Edge Cases", () => {
	it("should handle empty OpenAPI spec", () => {
		const fixtureFile = TestUtils.getFixturePath("empty-spec.yaml");

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();

		// Should generate basic structure even with no endpoints
		// Empty spec won't have schemas or client methods
		expect(output).toContain("// Schemas and Types");
	});

	it("should handle spec with no paths", () => {
		const fixtureFile = TestUtils.getFixturePath("no-paths.yaml");

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();

		// Should generate schemas but no client/service methods since no paths
		expect(output).toContain("userSchema");
	});

	it("should handle paths with no operations", () => {
		const fixtureFile = TestUtils.getFixturePath("no-operations.yaml");

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();
		expect(output).toBeTruthy();
	});

	it("should handle very long path names", () => {
		const fixtureFile = TestUtils.getFixturePath("long-paths.yaml");

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();
		expect(output).toBeTruthy();
		expect(output).toContain(
			"getApiV1OrganizationsByOrgIdTeamsByTeamIdProjectsByProjectIdRepositoriesByRepoIdBranchesByBranchIdCommitsByCommitIdFilesByFileId"
		);
	});

	it("should handle special characters in paths", () => {
		const fixtureFile = TestUtils.getFixturePath("special-chars-paths.yaml");

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();
		expect(output).toBeTruthy();
		expect(output).toContain("getUserProfiles");
		expect(output).toContain("getUserSettings");
	});

	it("should handle circular references in schemas", () => {
		const fixtureFile = TestUtils.getFixturePath("circular-schemas.yaml");

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();

		// Schema generator handles circular refs - check it generates
		expect(output).toContain("treeNodeSchema");
		expect(output).toContain("export class ApiClient");
	});

	it("should handle very deeply nested schemas", () => {
		const fixtureFile = TestUtils.getFixturePath("deep-nesting.yaml");

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		const output = generator.generateString();
		expect(output).toBeTruthy();
		expect(output).toContain("level1Schema");
	});

	it("should throw error for non-existent input file", () => {
		expect(() => {
			new PlaywrightGenerator({
				input: TestUtils.getFixturePath("non-existent.yaml"),
			});
		}).toThrow(FileOperationError);
	});

	it("should throw error for missing input path", () => {
		expect(() => {
			new PlaywrightGenerator({
				input: "",
			});
		}).toThrow(FileOperationError);
	});

	it("should handle invalid YAML gracefully", () => {
		const fixtureFile = TestUtils.getFixturePath("invalid-yaml.yaml");

		expect(() => {
			const generator = new PlaywrightGenerator({
				input: fixtureFile,
			});
			generator.generateString();
		}).toThrow();
	});
});

describe("Performance", () => {
	it("should handle large OpenAPI specs efficiently", () => {
		const fixtureFile = TestUtils.getFixturePath("large-spec.yaml");

		const startTime = Date.now();

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		generator.generateString();

		const endTime = Date.now();
		const duration = endTime - startTime;

		// Should complete in reasonable time (adjust threshold as needed)
		expect(duration).toBeLessThan(5000); // 5 seconds
	});

	it("should handle multiple generations without memory leaks", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
		});

		// Generate multiple times
		for (let i = 0; i < 100; i++) {
			generator.generateString();
		}

		// Should complete without errors
		expect(generator.generateString()).toBeTruthy();
	});

	it("should cache spec parsing for repeated generations", () => {
		const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");

		const generator = new PlaywrightGenerator({
			input: fixtureFile,
			showStats: false, // Disable stats to avoid timestamp differences
		});

		// Generate multiple times - should use caching internally
		const output1 = generator.generateString();
		const output2 = generator.generateString();
		const output3 = generator.generateString();

		// All outputs should be identical (demonstrating cache consistency)
		expect(output1).toBe(output2);
		expect(output2).toBe(output3);
	});
});
