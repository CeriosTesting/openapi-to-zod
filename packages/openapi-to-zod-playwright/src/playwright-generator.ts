import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import { ZodSchemaGenerator } from "@cerios/openapi-to-zod";
import { parse } from "yaml";
import { ClientGenerationError, ConfigurationError, FileOperationError, SpecValidationError } from "./errors";
import { generateClientClass } from "./generators/client-generator";
import { generateServiceClass } from "./generators/service-generator";
import type { PlaywrightGeneratorOptions } from "./types";
import { LRUCache } from "./utils/lru-cache";

/**
 * Main generator class for Playwright API clients
 * Generates Zod schemas, then appends client and service classes
 */
export class PlaywrightGenerator {
	private options: PlaywrightGeneratorOptions & { schemaType: "all" };
	private spec: OpenAPISpec | null = null;
	private static specCache = new LRUCache<string, OpenAPISpec>(50); // Cache for parsed specs

	constructor(options: PlaywrightGeneratorOptions) {
		// Input validation
		if (!options.input) {
			throw new FileOperationError("Input path is required", "");
		}

		if (!existsSync(options.input)) {
			throw new FileOperationError(`Input file not found: ${options.input}`, options.input);
		}

		// Validate outputService only allowed when generateService is true
		const generateService = options.generateService ?? true;
		if (options.outputService && !generateService) {
			throw new FileOperationError("outputService is only allowed when generateService is true", options.outputService);
		}

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
			generateService,
			schemaType: "all", // Always enforce all schemas
		};
	}

	/**
	 * Generate the complete output file(s)
	 * Handles splitting into multiple files based on outputClient and outputService options
	 */
	generate(): void {
		if (!this.options.output) {
			throw new FileOperationError(
				"Output path is required when calling generate(). " +
					"Either provide an 'output' option or use generateString() to get the result as a string.",
				""
			);
		}

		console.log(`Generating Playwright client for ${this.options.input}...`);

		try {
			const { outputClient, outputService, generateService } = this.options;
			const hasClientSplit = !!outputClient;
			const hasServiceSplit = !!outputService;

			// Ensure spec is parsed
			if (!this.spec) {
				this.spec = this.parseSpec();
			}

			// Generate base components
			const schemasString = this.generateSchemasString();
			const includeService = generateService ?? true;
			const clientString = this.generateClientString();
			const serviceString = includeService ? this.generateServiceString() : "";

			if (!hasClientSplit && !hasServiceSplit) {
				// Strategy 1: Everything in one file (default)
				const output = this.combineIntoSingleFile(schemasString, clientString, serviceString);
				writeFileSync(this.options.output, output, "utf-8");
				console.log(`✓ Successfully generated ${this.options.output}`);
			} else if (hasClientSplit && !hasServiceSplit) {
				// Strategy 2: Schemas (+ service if applicable) in main, client separate
				if (!outputClient) {
					throw new ConfigurationError("outputClient is required when using client split output mode", {
						hasClientSplit,
						hasServiceSplit,
						generateService: this.options.generateService,
					});
				}
				const mainOutput = includeService
					? this.combineIntoSingleFile(schemasString, "", serviceString)
					: schemasString;
				const clientOutput = this.generateClientFile();

				writeFileSync(this.options.output, mainOutput, "utf-8");
				writeFileSync(outputClient, clientOutput, "utf-8");
				console.log(`✓ Successfully generated ${this.options.output}`);
				console.log(`✓ Successfully generated ${outputClient}`);
			} else {
				// Strategy 3: All files separate (schemas, client, service)
				if (!outputClient) {
					throw new ConfigurationError("outputClient is required when using split output mode", {
						hasClientSplit,
						hasServiceSplit,
						generateService: this.options.generateService,
					});
				}
				if (!outputService) {
					throw new ConfigurationError(
						"outputService is required when using split output mode with service generation",
						{ hasClientSplit, hasServiceSplit, generateService: this.options.generateService }
					);
				}
				const clientOutput = this.generateClientFile();
				const serviceOutput = this.generateServiceFile(outputService, this.options.output, outputClient);
				writeFileSync(this.options.output, schemasString, "utf-8");
				writeFileSync(outputClient, clientOutput, "utf-8");
				writeFileSync(outputService, serviceOutput, "utf-8");
				console.log(`✓ Successfully generated ${this.options.output}`);
				console.log(`✓ Successfully generated ${outputClient}`);
				console.log(`✓ Successfully generated ${outputService}`);
			}
		} catch (error) {
			throw new ClientGenerationError(
				`Failed to generate Playwright client: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Generate the complete output as a string (without writing to file)
	 * @returns The generated TypeScript code including schemas, client, and service
	 */
	generateString(): string {
		try {
			// Ensure spec is parsed
			if (!this.spec) {
				this.spec = this.parseSpec();
			}

			const schemasString = this.generateSchemasString();
			const clientString = this.generateClientString();
			const includeService = this.options.generateService ?? true;
			const serviceString = includeService ? this.generateServiceString() : "";

			return this.combineIntoSingleFile(schemasString, clientString, serviceString);
		} finally {
			// Memory optimization: Clear spec after generation for large specs
			if (this.spec && JSON.stringify(this.spec).length > 100000) {
				this.spec = null;
			}
		}
	}

	/**
	 * Generate Zod schemas as a string
	 * @returns The generated Zod schemas TypeScript code
	 */
	generateSchemasString(): string {
		// Ensure spec is parsed
		if (!this.spec) {
			this.spec = this.parseSpec();
		}

		const schemaGenerator = new ZodSchemaGenerator(this.options);
		return schemaGenerator.generateString();
	}

	/**
	 * Generate the ApiClient class as a string
	 * @returns The generated ApiClient class TypeScript code
	 */
	generateClientString(): string {
		// Ensure spec is parsed
		if (!this.spec) {
			this.spec = this.parseSpec();
		}

		return generateClientClass(this.spec);
	}

	/**
	 * Generate the ApiService class as a string
	 * @returns The generated ApiService class TypeScript code
	 */
	generateServiceString(): string {
		// Ensure spec is parsed
		if (!this.spec) {
			this.spec = this.parseSpec();
		}

		const schemaImports = new Set<string>();
		return generateServiceClass(this.spec, schemaImports);
	}

	/**
	 * Parse the OpenAPI specification file with caching
	 * Enhanced with error context for better debugging
	 */
	private parseSpec(): OpenAPISpec {
		// Check cache first for performance
		const cached = PlaywrightGenerator.specCache.get(this.options.input);
		if (cached) {
			return cached;
		}

		const errorContext: { inputPath: string; fileSize?: string } = { inputPath: this.options.input };

		try {
			const content = readFileSync(this.options.input, "utf-8");
			const fileSize = content.length;
			Object.assign(errorContext, { fileSize: `${(fileSize / 1024).toFixed(2)} KB` });

			// Try parsing as YAML first (works for both YAML and JSON)
			let spec: OpenAPISpec;
			try {
				spec = parse(content) as OpenAPISpec;
			} catch (yamlError) {
				// If YAML parsing fails, try JSON
				try {
					spec = JSON.parse(content) as OpenAPISpec;
				} catch {
					const errorMessage = [
						`Failed to parse OpenAPI specification from: ${this.options.input}`,
						`File size: ${errorContext.fileSize}`,
						`Error: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`,
						"",
						"Please ensure:",
						"  - The file exists and is readable",
						"  - The file contains valid YAML or JSON syntax",
						"  - The file is a valid OpenAPI 3.x specification",
					].join("\n");

					throw new SpecValidationError(
						errorMessage,
						this.options.input,
						yamlError instanceof Error ? yamlError : undefined
					);
				}
			}

			// Validate basic spec structure
			if (!("openapi" in spec) && !("swagger" in spec)) {
				throw new SpecValidationError(
					`Invalid OpenAPI specification: Missing 'openapi' or 'swagger' version field\n` +
						`File: ${this.options.input}\n` +
						`Size: ${errorContext.fileSize}`,
					this.options.input
				);
			}

			// Cache the parsed spec for performance
			PlaywrightGenerator.specCache.set(this.options.input, spec);
			return spec;
		} catch (error) {
			if (error instanceof SpecValidationError) {
				throw error;
			}
			const errorMessage = [
				`Failed to read OpenAPI specification file: ${this.options.input}`,
				`Context: ${JSON.stringify(errorContext)}`,
				`Error: ${error instanceof Error ? error.message : String(error)}`,
			].join("\n");

			throw new FileOperationError(errorMessage, this.options.input, error instanceof Error ? error : undefined);
		}
	}

	/**
	 * Helper method to combine schemas, client, and service into single file
	 */
	private combineIntoSingleFile(schemasString: string, clientString: string, serviceString: string): string {
		// Only import expect if service is being generated
		const includeService = this.options.generateService ?? true;
		const expectImport = includeService ? 'import { expect } from "@playwright/test";\n' : "";
		const playwrightImports = `import type { APIRequestContext, APIResponse } from "@playwright/test";\n${expectImport}\n`;

		// Insert Playwright imports after existing imports
		let output = this.insertPlaywrightImports(schemasString, playwrightImports);

		// Append classes at the end
		output += `\n${clientString}`;
		if (serviceString) {
			output += `\n${serviceString}`;
		}

		return output;
	}

	/**
	 * Helper method to insert Playwright imports after existing imports
	 */
	private insertPlaywrightImports(content: string, playwrightImports: string): string {
		const importRegex = /^import\s+.*?;$/gm;
		const matches = [...content.matchAll(importRegex)];

		if (matches.length > 0) {
			const lastImport = matches[matches.length - 1];
			if (lastImport.index !== undefined) {
				const insertPos = lastImport.index + lastImport[0].length + 1;
				return content.slice(0, insertPos) + playwrightImports + content.slice(insertPos);
			}
		}

		// No imports found, add at the beginning
		return playwrightImports + content;
	}

	/**
	 * Generate client file with proper imports
	 */
	private generateClientFile(): string {
		const clientString = this.generateClientString();

		// Client is a passthrough and doesn't need schema imports
		return `import type { APIRequestContext, APIResponse } from "@playwright/test";\n\n${clientString}`;
	}

	/**
	 * Generate service file with proper imports
	 */
	private generateServiceFile(servicePath: string, mainPath: string, clientPath: string): string {
		const serviceString = this.generateServiceString();
		const relativeImportMain = this.generateRelativeImport(servicePath, mainPath);
		const relativeImportClient = this.generateRelativeImport(servicePath, clientPath);

		// Extract schema/type names and filter to only those used in service
		const allSchemas = this.extractSchemaNames();
		const usedSchemas = allSchemas.filter(schemaName => serviceString.includes(schemaName));

		// Separate schemas (values) from types (type-only imports)
		// Schemas end with "Schema" and are used as values for .parse()
		// Types are TypeScript types only
		const schemaValues = usedSchemas.filter(name => name.endsWith("Schema"));
		const schemaTypes = usedSchemas.filter(name => !name.endsWith("Schema"));

		let schemaImportStatement = "";
		if (schemaValues.length > 0) {
			schemaImportStatement += `import { ${schemaValues.join(", ")} } from "${relativeImportMain}";\n`;
		}
		if (schemaTypes.length > 0) {
			schemaImportStatement += `import type { ${schemaTypes.join(", ")} } from "${relativeImportMain}";\n`;
		}

		// Only import ApiClientOptions/MultipartFormValue if service uses them
		const usesOptions = serviceString.includes("ApiClientOptions");
		const usesMultipart = serviceString.includes("MultipartFormValue");
		const clientImports = ["ApiClient"];
		if (usesOptions) clientImports.push("type ApiClientOptions");
		if (usesMultipart) clientImports.push("type MultipartFormValue");

		return `import { z } from "zod";\nimport { expect } from "@playwright/test";\nimport { ${clientImports.join(", ")} } from "${relativeImportClient}";\n${schemaImportStatement}\n${serviceString}`;
	}

	/**
	 * Generate relative import path from one file to another
	 */
	private generateRelativeImport(from: string, to: string): string {
		const fromDir = dirname(from);
		let relativePath = relative(fromDir, to);

		// Remove .ts extension if present
		relativePath = relativePath.replace(/\.ts$/, "");

		// Ensure relative path starts with ./ or ../
		if (!relativePath.startsWith(".")) {
			relativePath = `./${relativePath}`;
		}

		// Normalize path separators for TypeScript imports (always use /)
		return relativePath.replace(/\\/g, "/");
	}

	/**
	 * Extract schema and type names from generated schemas
	 */
	private extractSchemaNames(): string[] {
		const schemasString = this.generateSchemasString();
		const names = new Set<string>();

		// Match export const X = z.object...
		const schemaRegex = /export const (\w+)\s*=/g;
		let match = schemaRegex.exec(schemasString);
		while (match !== null) {
			names.add(match[1]);
			match = schemaRegex.exec(schemasString);
		}

		// Match export type X = ...
		const typeRegex = /export type (\w+)\s*=/g;
		match = typeRegex.exec(schemasString);
		while (match !== null) {
			names.add(match[1]);
			match = typeRegex.exec(schemasString);
		}

		return Array.from(names);
	}
}
