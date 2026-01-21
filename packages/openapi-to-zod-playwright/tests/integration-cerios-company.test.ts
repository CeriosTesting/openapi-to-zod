import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("Integration Tests for Cerios Company", () => {
	const fixtureFile = TestUtils.getFixturePath("cerios-company.json");

	describe("stripSchemaPrefix should work correctly", () => {
		const schemasFile = TestUtils.getOutputPath("cerios-company/stripSchemaPrefix-schemas.ts");
		let schemasContent: string;
		const clientFile = TestUtils.getOutputPath("cerios-company/stripSchemaPrefix-client.ts");
		let clientContent: string;
		const serviceFile = TestUtils.getOutputPath("cerios-company/stripSchemaPrefix-service.ts");
		let serviceContent: string;

		// Create a temporary tsconfig that maps the package to the source
		const tempTsConfigPath = TestUtils.getOutputPath("cerios-company/tsconfig.test.json");

		beforeAll(() => {
			const generator = new OpenApiPlaywrightGenerator({
				input: fixtureFile,
				output: schemasFile,
				outputClient: clientFile,
				outputService: serviceFile,
				stripSchemaPrefix: "Messier.Libraries.Cerios.Entities.",
			});
			generator.generate();

			schemasContent = generator.generateSchemasString();
			clientContent = generator.generateClientString();
			serviceContent = generator.generateServiceString();

			// Create temporary tsconfig with path mappings for package imports
			// Path must be relative to the tsconfig location (tests/output/cerios-company -> src)
			const tsConfig = {
				compilerOptions: {
					target: "ES2020",
					module: "ESNext",
					moduleResolution: "bundler",
					strict: true,
					skipLibCheck: true,
					noEmit: true,
					baseUrl: ".",
					paths: {
						"@cerios/openapi-to-zod-playwright": ["../../../src/index.ts"],
					},
				},
				include: ["./*.ts"],
			};
			writeFileSync(tempTsConfigPath, JSON.stringify(tsConfig, null, 2));
		});

		it("schemas should compile without errors", { timeout: 10_000 }, () => {
			try {
				execSync(`npx tsc --noEmit --skipLibCheck ${schemasFile}`, {
					stdio: "pipe",
					encoding: "utf-8",
				});
			} catch (error: any) {
				const output = error.stdout || error.stderr || error.message;
				throw new Error(`TypeScript compilation failed:\n${output}`);
			}
		});

		it("schemas should contain correct type references", () => {
			expect(schemasContent).not.toContain(" MessierLibrariesCeriosEntitiesArchiveCompactDocumentSearch ");
			expect(schemasContent).toContain(" ArchiveCompactDocumentSearch ");
		});

		it("schemas should contain correct schema references", () => {
			expect(schemasContent).not.toContain("messierLibrariesCeriosEntitiesArchiveCompactDocumentSchema");
			expect(schemasContent).toContain("archiveCompactDocumentSchema");
		});

		it("client should compile without errors", { timeout: 10_000 }, () => {
			try {
				execSync(`npx tsc --project ${tempTsConfigPath}`, {
					stdio: "pipe",
					encoding: "utf-8",
					cwd: dirname(clientFile),
				});
			} catch (error: any) {
				const output = error.stdout || error.stderr || error.message;
				throw new Error(`TypeScript compilation failed:\n${output}`);
			}
		});

		it("client should contain correct method", () => {
			expect(clientContent).toContain(" /api/v0.1/ArchiveCompact/Documents/Search");
		});

		it("service should compile without errors", { timeout: 10_000 }, () => {
			try {
				execSync(`npx tsc --project ${tempTsConfigPath}`, {
					stdio: "pipe",
					encoding: "utf-8",
					cwd: dirname(serviceFile),
				});
			} catch (error: any) {
				const output = error.stdout || error.stderr || error.message;
				throw new Error(`TypeScript compilation failed:\n${output}`);
			}
		});

		it("service should contain correct type references", () => {
			expect(serviceContent).not.toContain(" MessierLibrariesCeriosEntitiesArchiveCompactDocumentSearch ");
			expect(serviceContent).toContain(" ArchiveCompactDocumentSearch ");
		});

		it("service should contain correct schema references", () => {
			expect(serviceContent).not.toContain("messierLibrariesCeriosEntitiesArchiveCompactDocumentSchema");
			expect(serviceContent).toContain("archiveCompactDocumentSchema");
		});
	});
});
