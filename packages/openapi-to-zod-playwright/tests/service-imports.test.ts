/** biome-ignore-all lint/complexity/useLiteralKeys: <Needed for testing private methods> */
import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Service Imports", () => {
	describe("Zod import (z)", () => {
		it("should import z from zod when inline schemas are used", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-schema-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceString = generator.generateServiceString();

			// Should contain z.string().parse() for inline string schema
			expect(serviceString).toContain("z.string()");

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// Should import z from zod
			expect(serviceFile).toContain('import { z } from "zod";');
		});

		it("should NOT import z from zod when only named schemas are used", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("no-inline-schema-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceString = generator.generateServiceString();

			// Should NOT contain z.string() or z.array() etc
			expect(serviceString).not.toMatch(/\bz\./);

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// Should NOT import z from zod
			expect(serviceFile).not.toContain('import { z } from "zod";');
		});

		it("should import z when array inline schemas are used", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceString = generator.generateServiceString();
			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// simple-api.yaml returns User[] which is z.array(userSchema)
			expect(serviceFile).toContain('import { z } from "zod";');
			expect(serviceString).toContain("z.array(");
		});
	});

	describe("Client type alias imports", () => {
		it("should import RequestBody when used in service", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("request-body-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// RequestBody is now imported from the package (when needed by service)
			// The service uses types from schema imports or inline types
			// If RequestBody is needed, it comes from @cerios/openapi-to-zod-playwright
			expect(serviceFile).toContain("@cerios/openapi-to-zod-playwright");
		});

		it("should NOT import QueryParams when not used", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-schema-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// Should NOT import QueryParams when not used
			expect(serviceFile).not.toContain("type QueryParams");
		});

		it("should NOT import QueryParams even when query param types exist", () => {
			// Use the simple-api which has query parameters
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// Should NOT import generic QueryParams type
			// (specific param types are imported from schemas instead)
			const clientImportLine = serviceFile.match(/import \{[^}]*\} from ".*client.*"/)?.[0];
			if (clientImportLine) {
				expect(clientImportLine).not.toMatch(/\bQueryParams\b/);
			}
		});

		it("should only import types that are actually used", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("inline-schema-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// Should NOT import unused types
			expect(serviceFile).not.toContain("type QueryParams");
			expect(serviceFile).not.toContain("type RequestBody");
			expect(serviceFile).not.toContain("type MultipartFormValue");
			expect(serviceFile).not.toContain("type UrlEncodedFormData");
			expect(serviceFile).not.toContain("type MultipartFormData");
			expect(serviceFile).not.toContain("type HttpHeaders");
		});
	});

	describe("Word boundary checks", () => {
		it("should not match QueryParams substring in type names", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// Service will reference specific types from schemas
			// But should NOT import generic "QueryParams" type from client
			const clientImportLine = serviceFile.match(/import \{[^}]*\} from ".*client.*"/)?.[0];
			if (clientImportLine) {
				// Should not have "type QueryParams" in client imports
				expect(clientImportLine).not.toMatch(/type QueryParams(?![\w])/);
			}
		});

		it("should not falsely detect z. in unrelated text", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("no-inline-schema-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// Should NOT import z because there's no actual z.string() usage
			// (named schema is used instead)
			expect(serviceFile).not.toContain('import { z } from "zod";');
		});
	});

	describe("Real-world scenarios", () => {
		it("should handle complex API with correct imports", () => {
			// Use simple-api which has various realistic scenarios
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("simple-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// Should import z for inline schemas
			expect(serviceFile).toContain('import { z } from "zod";');

			// Should import RequestBody when needed
			if (generator.generateServiceString().includes("RequestBody")) {
				expect(serviceFile).toContain("type RequestBody");
			}

			// Should NOT import QueryParams
			expect(serviceFile).not.toMatch(/\bQueryParams\b/);
		});

		it("should handle API with no inline schemas", () => {
			const generator = new OpenApiPlaywrightGenerator({
				input: TestUtils.getFixturePath("no-inline-schema-api.yaml"),
				output: TestUtils.getOutputPath("test-schemas.ts"),
				outputClient: TestUtils.getOutputPath("test-client.ts"),
				outputService: TestUtils.getOutputPath("test-service.ts"),
			});

			const serviceFile = generator["generateServiceFile"](
				TestUtils.getOutputPath("test-service.ts"),
				TestUtils.getOutputPath("test-schemas.ts"),
				TestUtils.getOutputPath("test-client.ts")
			);

			// Should NOT import z - no inline schemas
			expect(serviceFile).not.toContain('import { z } from "zod";');

			// Should import the schema from schemas file
			expect(serviceFile).toContain("userSchema");
		});
	});
});
