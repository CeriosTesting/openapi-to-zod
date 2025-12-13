import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Split Files - Path Edge Cases", () => {
	const fixtureFile = TestUtils.getFixturePath("simple-api.yaml");
	const outputDir = TestUtils.getOutputPath("");

	// Clean up nested directories after each test
	afterEach(() => {
		const dirsToClean = [
			join(outputDir, "nested"),
			join(outputDir, "clients"),
			join(outputDir, "services"),
			join(outputDir, "schemas"),
			join(outputDir, "deep"),
			join(outputDir, "a"),
		];

		for (const dir of dirsToClean) {
			if (existsSync(dir)) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

	describe("Same directory scenarios", () => {
		it("should handle all files in same directory with ./ imports", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("api-schemas.ts"),
				outputClient: TestUtils.getOutputPath("api-client.ts"),
				outputService: TestUtils.getOutputPath("api-service.ts"),
			});

			generator.generate();

			const clientContent = readFileSync(TestUtils.getOutputPath("api-client.ts"), "utf-8");
			const serviceContent = readFileSync(TestUtils.getOutputPath("api-service.ts"), "utf-8");

			// Client should have no schema imports (passthrough)
			expect(clientContent).toContain('import type { APIRequestContext, APIResponse } from "@playwright/test"');
			expect(clientContent).not.toContain("./api-schemas");

			// Service should import from both with ./ prefix
			expect(serviceContent).toContain('from "./api-client"');
			expect(serviceContent).toContain('from "./api-schemas"');

			// Should never use old type name
			expect(serviceContent).not.toContain("ApiClientOptions");
		});
	});

	describe("One level up/down scenarios", () => {
		it("should handle client one level down from schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("schemas.ts"),
				outputClient: TestUtils.getOutputPath("clients/api-client.ts"),
				outputService: TestUtils.getOutputPath("services/api-service.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("services/api-service.ts"), "utf-8");

			// Service should import client from sibling directory
			expect(serviceContent).toContain('from "../clients/api-client"');
			// Service should import schemas from parent directory
			expect(serviceContent).toContain('from "../schemas"');
		});

		it("should handle schemas one level down from client", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("nested/schemas.ts"),
				outputClient: TestUtils.getOutputPath("client.ts"),
				outputService: TestUtils.getOutputPath("service.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("service.ts"), "utf-8");

			// Service imports from same dir and nested dir
			expect(serviceContent).toContain('from "./client"');
			expect(serviceContent).toContain('from "./nested/schemas"');
		});

		it("should handle all files one level down in different subdirs", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("nested/schemas/main.ts"),
				outputClient: TestUtils.getOutputPath("nested/clients/api.ts"),
				outputService: TestUtils.getOutputPath("nested/services/api.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("nested/services/api.ts"), "utf-8");

			// Service should navigate to sibling directories
			expect(serviceContent).toContain('from "../clients/api"');
			expect(serviceContent).toContain('from "../schemas/main"');
		});
	});

	describe("Deep nesting scenarios", () => {
		it("should handle deeply nested schemas with shallow client", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("deep/nested/structure/schemas.ts"),
				outputClient: TestUtils.getOutputPath("client.ts"),
				outputService: TestUtils.getOutputPath("service.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("service.ts"), "utf-8");

			expect(serviceContent).toContain('from "./client"');
			expect(serviceContent).toContain('from "./deep/nested/structure/schemas"');
		});

		it("should handle shallow schemas with deeply nested client and service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("schemas.ts"),
				outputClient: TestUtils.getOutputPath("deep/nested/client/api.ts"),
				outputService: TestUtils.getOutputPath("deep/nested/service/api.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("deep/nested/service/api.ts"), "utf-8");

			// Navigate up three levels, then to sibling, then down
			expect(serviceContent).toContain('from "../client/api"');
			// Navigate up three levels to root
			expect(serviceContent).toContain('from "../../../schemas"');
		});

		it("should handle all files deeply nested in parallel structures", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("a/b/c/schemas.ts"),
				outputClient: TestUtils.getOutputPath("a/b/d/client.ts"),
				outputService: TestUtils.getOutputPath("a/b/e/service.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("a/b/e/service.ts"), "utf-8");

			// Navigate to sibling directories at same depth
			expect(serviceContent).toContain('from "../d/client"');
			expect(serviceContent).toContain('from "../c/schemas"');
		});
	});

	describe("Complex cross-directory scenarios", () => {
		it("should handle schema at root, client deep, service deeper", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("root-schemas.ts"),
				outputClient: TestUtils.getOutputPath("clients/v1/api-client.ts"),
				outputService: TestUtils.getOutputPath("services/v1/test/api-service.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("services/v1/test/api-service.ts"), "utf-8");

			// Navigate up to parent, then to clients branch
			expect(serviceContent).toContain('from "../../../clients/v1/api-client"');
			// Navigate up three levels to root
			expect(serviceContent).toContain('from "../../../root-schemas"');
		});

		it("should handle completely divergent paths", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("a/schemas/main.ts"),
				outputClient: TestUtils.getOutputPath("clients/b/api.ts"),
				outputService: TestUtils.getOutputPath("services/c/d/test.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("services/c/d/test.ts"), "utf-8");

			// From services/c/d up to root, then to clients/b
			expect(serviceContent).toContain('from "../../../clients/b/api"');
			// From services/c/d up to root, then to a/schemas
			expect(serviceContent).toContain('from "../../../a/schemas/main"');
		});
	});

	describe("Windows vs Unix path handling", () => {
		it("should normalize backslashes to forward slashes in imports", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("schemas\\types\\main.ts"),
				outputClient: TestUtils.getOutputPath("clients\\api\\client.ts"),
				outputService: TestUtils.getOutputPath("services\\api\\service.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("services/api/service.ts"), "utf-8");

			// Should use forward slashes in imports, never backslashes
			expect(serviceContent).not.toContain("\\");
			expect(serviceContent).toContain('from "../../clients/api/client"');
			expect(serviceContent).toContain('from "../../schemas/types/main"');
		});
	});

	describe("Class name derivation with paths", () => {
		it("should derive correct class names from nested file paths", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("api/v1/schemas.ts"),
				outputClient: TestUtils.getOutputPath("api/v1/petstore-client.ts"),
				outputService: TestUtils.getOutputPath("api/v1/petstore-service.ts"),
			});

			generator.generate();

			const clientContent = readFileSync(TestUtils.getOutputPath("api/v1/petstore-client.ts"), "utf-8");
			const serviceContent = readFileSync(TestUtils.getOutputPath("api/v1/petstore-service.ts"), "utf-8");

			// Class names should be derived from filename, not full path
			expect(clientContent).toContain("export class PetstoreClient");
			expect(serviceContent).toContain("export class PetstoreService");
			expect(serviceContent).toContain("private readonly client: PetstoreClient");
		});

		it("should handle different naming patterns across directories", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("core/types.ts"),
				outputClient: TestUtils.getOutputPath("http/my-api-client.ts"),
				outputService: TestUtils.getOutputPath("testing/my-api-service.ts"),
			});

			generator.generate();

			const clientContent = readFileSync(TestUtils.getOutputPath("http/my-api-client.ts"), "utf-8");
			const serviceContent = readFileSync(TestUtils.getOutputPath("testing/my-api-service.ts"), "utf-8");

			// Should strip -client/-service suffixes
			expect(clientContent).toContain("export class MyApiClient");
			expect(serviceContent).toContain("export class MyApiService");
			expect(serviceContent).toContain("private readonly client: MyApiClient");
		});
	});

	describe("Import type detection", () => {
		it("should correctly detect ApiRequestContextOptions usage in service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("schemas.ts"),
				outputClient: TestUtils.getOutputPath("clients/api.ts"),
				outputService: TestUtils.getOutputPath("services/api.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("services/api.ts"), "utf-8");

			// Should import the correct type name (not the old ApiClientOptions)
			if (serviceContent.includes("ApiRequestContextOptions")) {
				expect(serviceContent).toContain("type ApiRequestContextOptions");
				expect(serviceContent).not.toContain("ApiClientOptions");
			}
		});

		it("should conditionally import MultipartFormValue when used", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("schemas.ts"),
				outputClient: TestUtils.getOutputPath("nested/client.ts"),
				outputService: TestUtils.getOutputPath("nested/service.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("nested/service.ts"), "utf-8");

			// Only import if actually used in the service
			const hasMultipartMethods = serviceContent.includes("multipart:");
			if (hasMultipartMethods) {
				expect(serviceContent).toContain("type MultipartFormValue");
			}
		});
	});

	describe("Error handling", () => {
		it("should handle relative path when files share common ancestor", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("shared/api/schemas.ts"),
				outputClient: TestUtils.getOutputPath("shared/clients/api.ts"),
				outputService: TestUtils.getOutputPath("shared/services/api.ts"),
			});

			expect(() => generator.generate()).not.toThrow();

			const serviceContent = readFileSync(TestUtils.getOutputPath("shared/services/api.ts"), "utf-8");

			// Verify correct relative imports
			expect(serviceContent).toContain('from "../clients/api"');
			expect(serviceContent).toContain('from "../api/schemas"');
		});
	});

	describe("Real-world directory structures", () => {
		it("should handle typical src/tests split structure", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("schemas/generated/api.ts"),
				outputClient: TestUtils.getOutputPath("clients/generated/api-client.ts"),
				outputService: TestUtils.getOutputPath("services/generated/api-service.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("services/generated/api-service.ts"), "utf-8");

			expect(serviceContent).toContain('from "../../clients/generated/api-client"');
			expect(serviceContent).toContain('from "../../schemas/generated/api"');
		});

		it("should handle monorepo packages structure", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("schemas/api/types.ts"),
				outputClient: TestUtils.getOutputPath("clients/http/api.ts"),
				outputService: TestUtils.getOutputPath("services/testing/api.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("services/testing/api.ts"), "utf-8");

			expect(serviceContent).toContain('from "../../clients/http/api"');
			expect(serviceContent).toContain('from "../../schemas/api/types"');
		});

		it("should handle lib/src/generated pattern", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: TestUtils.getOutputPath("deep/lib/generated/schemas.ts"),
				outputClient: TestUtils.getOutputPath("deep/src/api/client.ts"),
				outputService: TestUtils.getOutputPath("deep/src/api/service.ts"),
			});

			generator.generate();

			const serviceContent = readFileSync(TestUtils.getOutputPath("deep/src/api/service.ts"), "utf-8");

			expect(serviceContent).toContain('from "./client"');
			expect(serviceContent).toContain('from "../../lib/generated/schemas"');
		});
	});
});
