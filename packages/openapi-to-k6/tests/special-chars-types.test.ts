import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { OpenApiK6Generator } from "../src/openapi-k6-generator";

/**
 * Tests for schema names with special characters (underscores, dots, hyphens)
 *
 * This addresses the bug where types like "Org_Entity_POST" were being
 * imported with inconsistent names between the service file and types file.
 *
 * The fix ensures that type names are normalized using toPascalCase
 * consistently across all generators.
 */
describe("Special Characters in Schema Names", () => {
	const fixtureFile = resolve(__dirname, "fixtures/special-chars-api.yaml");

	describe("underscore handling", () => {
		it("should normalize underscore schema names in service imports", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			// Should NOT have raw underscore names in imports
			expect(serviceOutput).not.toContain("Org_Entity_POST");
			expect(serviceOutput).not.toContain("Org_Entity_Response");

			// Should have normalized PascalCase names
			expect(serviceOutput).toContain("OrgEntityPOST");
			expect(serviceOutput).toContain("OrgEntityResponse");
		});

		it("should use normalized type name in request body parameter", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			// Method signature should use normalized type
			expect(serviceOutput).toMatch(/body\??: OrgEntityPOST/);
		});

		it("should use normalized type name in response type", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			// Return type should use normalized type
			expect(serviceOutput).toContain("K6ServiceResult<OrgEntityResponse>");
		});
	});

	describe("dot handling", () => {
		it("should normalize dotted schema names", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			// Should NOT have dots in type names (invalid TypeScript)
			expect(serviceOutput).not.toContain("Address.With.Dots");

			// Should have normalized name
			expect(serviceOutput).toContain("AddressWithDots");
		});

		it("should handle array of dotted schema types", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			// Return type for array should be normalized
			expect(serviceOutput).toContain("K6ServiceResult<AddressWithDots[]>");
		});
	});

	describe("hyphen handling", () => {
		it("should normalize hyphenated schema names", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			// Should NOT have hyphens in type names (invalid TypeScript)
			expect(serviceOutput).not.toContain("item-create-request");
			expect(serviceOutput).not.toContain("item-response");

			// Should have normalized PascalCase names
			expect(serviceOutput).toContain("ItemCreateRequest");
			expect(serviceOutput).toContain("ItemResponse");
		});

		it("should use normalized type in request body for hyphenated schema", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			expect(serviceOutput).toMatch(/body\??: ItemCreateRequest/);
		});
	});

	describe("mixed separators", () => {
		it("should normalize schema names with mixed separators", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			// Should NOT have any special characters in type names
			expect(serviceOutput).not.toContain("My.Namespace_Item-Type");
			expect(serviceOutput).not.toContain("API_Response_DTO");

			// Should have normalized names
			expect(serviceOutput).toContain("MyNamespaceItemType");
			expect(serviceOutput).toContain("APIResponseDTO");
		});
	});

	describe("type consistency", () => {
		it("should import all types used in method signatures", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			// Extract import statement
			const importMatch = serviceOutput.match(/import type \{([^}]+)\} from "\.\/test-types"/);
			expect(importMatch).toBeTruthy();
			if (!importMatch) return;

			const importedTypes = importMatch[1]
				.split(",")
				.map(t => t.trim())
				.filter(t => t.length > 0);

			// All schema types used should be in imports
			const expectedTypes = [
				"OrgEntityPOST",
				"OrgEntityResponse",
				"AddressWithDots",
				"ItemCreateRequest",
				"ItemResponse",
				"MyNamespaceItemType",
				"APIResponseDTO",
			];

			for (const expectedType of expectedTypes) {
				expect(importedTypes).toContain(expectedType);
			}
		});

		it("should match types between TypeScript generator and service generator", () => {
			const generator = new OpenApiK6Generator({
				input: fixtureFile,
				outputClient: "test-client.ts",
				outputTypes: "test-types.ts",
				outputService: "test-service.ts",
				useOperationId: true,
			});

			const typesOutput = generator.generateSchemaTypesString();
			const serviceOutput = generator.generateServiceString("./test-client", "./test-types");

			// Extract imported types from service (excluding Params/Headers)
			const importMatch = serviceOutput.match(/import type \{([^}]+)\} from "\.\/test-types"/);
			expect(importMatch).toBeTruthy();
			if (!importMatch) return;

			const importedTypes = importMatch[1]
				.split(",")
				.map(t => t.trim())
				.filter(t => t.length > 0 && !t.endsWith("Params") && !t.endsWith("Headers"));

			// Each imported type should exist as an export in types file
			for (const typeName of importedTypes) {
				expect(typesOutput).toContain(`export type ${typeName}`);
			}
		});
	});
});
