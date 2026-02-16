import { describe, expect, it } from "vitest";

import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";

import { TestUtils } from "./utils/test-utils";

describe("At-sign path segment naming", () => {
	const fixtureFile = TestUtils.getFixturePath("at-sign-paths.yaml");

	it('should replace "@" with "At" in client method names', () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
			useOperationId: false,
		});

		const clientOutput = generator.generateClientString();

		expect(clientOutput).toContain("async getResourcesAtCollectionByCollectionId(collectionId: string");
		expect(clientOutput).toContain("async deleteResourcesByResourceIdAtArchive(resourceId: string");
		expect(clientOutput).not.toMatch(/async [^(]*@/);
	});

	it('should replace "@" with "At" in service method names', () => {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
			outputTypes: "output.ts",
			outputClient: "client.ts",
			outputService: "service.ts",
			useOperationId: false,
		});

		const serviceOutput = generator.generateServiceString();

		expect(serviceOutput).toContain("async getResourcesAtCollectionByCollectionId(collectionId: string");
		expect(serviceOutput).toContain("async deleteResourcesByResourceIdAtArchive(resourceId: string");
		expect(serviceOutput).not.toMatch(/async [^(]*@/);
	});
});
