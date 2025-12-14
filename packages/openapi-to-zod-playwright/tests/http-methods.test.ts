import { describe, expect, it } from "vitest";
import { OpenApiPlaywrightGenerator } from "../src/openapi-playwright-generator";
import { TestUtils } from "./utils/test-utils";

describe("HTTP Methods", () => {
	const fixtureFile = TestUtils.getFixturePath("http-methods-api.yaml");

	function generateOutput(): string {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
		});
		return generator.generateClientString();
	}

	function generateServiceOutput(): string {
		const generator = new OpenApiPlaywrightGenerator({
			input: fixtureFile,
		});
		return generator.generateServiceString();
	}

	it("should generate GET methods", () => {
		const output = generateOutput();
		expect(output).toContain("async getUsers(");
		expect(output).toContain("await this.request.get(");
	});

	it("should generate POST methods", () => {
		const output = generateOutput();
		expect(output).toContain("async postUsers(");
		expect(output).toContain("await this.request.post(");
	});

	it("should generate PUT methods", () => {
		const output = generateOutput();
		expect(output).toContain("async putUsers(");
		expect(output).toContain("await this.request.put(");
	});

	it("should generate PATCH methods", () => {
		const output = generateOutput();
		expect(output).toContain("async patchUsers(");
		expect(output).toContain("await this.request.patch(");
	});

	it("should generate DELETE methods", () => {
		const output = generateOutput();
		expect(output).toContain("async deleteUsers(");
		expect(output).toContain("await this.request.delete(");
	});

	it("should generate HEAD methods", () => {
		const output = generateOutput();
		expect(output).toContain("async headUsers(");
		expect(output).toContain("await this.request.head(");
	});

	it("should generate OPTIONS methods", () => {
		const output = generateOutput();
		expect(output).toContain("async optionsUsers(");
		expect(output).toContain("await this.request.options(");
	});

	it("should generate client and service classes", () => {
		const clientOutput = generateOutput();
		const serviceOutput = generateServiceOutput();
		expect(clientOutput).toContain("export class ApiClient");
		expect(serviceOutput).toContain("export class ApiService");
	});
});
