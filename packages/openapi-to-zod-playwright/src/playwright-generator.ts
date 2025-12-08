import { readFileSync, writeFileSync } from "node:fs";
import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import { ZodSchemaGenerator } from "@cerios/openapi-to-zod";
import { parse } from "yaml";
import { generateClientClass } from "./generators/client-generator";
import { generateServiceClass } from "./generators/service-generator";
import type { PlaywrightGeneratorOptions } from "./types";

/**
 * Main generator class for Playwright API clients
 * Generates Zod schemas, then appends client and service classes
 */
export class PlaywrightGenerator {
	private options: PlaywrightGeneratorOptions & { schemaType: "all" };
	private spec: OpenAPISpec | null = null;

	constructor(options: PlaywrightGeneratorOptions) {
		this.options = {
			mode: options.mode || "normal",
			typeMode: options.typeMode || "inferred",
			enumType: options.enumType || "zod",
			nativeEnumType: options.nativeEnumType || "union",
			includeDescriptions: options.includeDescriptions ?? true,
			useDescribe: options.useDescribe ?? false,
			showStats: options.showStats ?? true,
			prefix: options.prefix || "",
			suffix: options.suffix || "",
			...options,
			schemaType: "all", // Always enforce all schemas
		};
	}

	/**
	 * Generate the complete output file
	 */
	generate(): void {
		// biome-ignore lint/suspicious/noConsole: CLI output
		console.log(`Generating Playwright client for ${this.options.input}...`);

		// Step 1: Parse OpenAPI spec
		this.spec = this.parseSpec();

		// Step 2: Generate Zod schemas using the core generator
		this.generateSchemas();

		// Step 3: Append client and service classes
		this.appendClasses();

		// biome-ignore lint/suspicious/noConsole: CLI output
		console.log(`✓ Successfully generated ${this.options.output}`);
	}

	/**
	 * Parse the OpenAPI specification file
	 */
	private parseSpec(): OpenAPISpec {
		try {
			const content = readFileSync(this.options.input, "utf-8");

			// Try parsing as YAML first (works for both YAML and JSON)
			try {
				return parse(content) as OpenAPISpec;
			} catch {
				// If YAML parsing fails, try JSON
				return JSON.parse(content) as OpenAPISpec;
			}
		} catch (error) {
			throw new Error(
				`Failed to parse OpenAPI specification at ${this.options.input}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Generate Zod schemas using the core generator
	 */
	private generateSchemas(): void {
		const schemaGenerator = new ZodSchemaGenerator(this.options);
		schemaGenerator.generate();
	}

	/**
	 * Append client and service classes to the generated file
	 */
	private appendClasses(): void {
		if (!this.spec) {
			throw new Error("OpenAPI spec not parsed");
		}

		// Read the generated schemas file
		let output = readFileSync(this.options.output, "utf-8");

		// Track which schemas are used by the service layer
		const schemaImports = new Set<string>();

		// Generate client class
		const clientClass = generateClientClass(this.spec);

		// Generate service class
		const serviceClass = generateServiceClass(this.spec, schemaImports);

		// Add Playwright imports at the top
		const playwrightImports = `import type { APIRequestContext, APIResponse } from "@playwright/test";\nimport { expect } from "@playwright/test";\n\n`;

		// Find where to insert imports (after existing imports)
		const importRegex = /^import\s+.*?;$/gm;
		const matches = [...output.matchAll(importRegex)];

		if (matches.length > 0) {
			const lastImport = matches[matches.length - 1];
			if (lastImport.index !== undefined) {
				const insertPos = lastImport.index + lastImport[0].length + 1;
				output = output.slice(0, insertPos) + playwrightImports + output.slice(insertPos);
			}
		} else {
			// No imports found, add at the beginning
			output = playwrightImports + output;
		}

		// Append classes at the end
		output += `\n${clientClass}`;
		output += `\n${serviceClass}`;

		// Write the final output
		writeFileSync(this.options.output, output, "utf-8");
	}
}
