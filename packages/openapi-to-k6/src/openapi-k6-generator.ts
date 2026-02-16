import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, normalize, relative } from "node:path";

import type { Generator, OpenAPISpec } from "@cerios/openapi-core";
import { FileOperationError, LRUCache, loadOpenAPISpecCached } from "@cerios/openapi-core";
import { TypeScriptGenerator } from "@cerios/openapi-to-typescript";

import { K6ClientGenerationError } from "./errors";
import { generateK6ClientCode, generateK6TypesCode, getEndpointStats } from "./generators/client-generator";
import { generateK6ServiceCode, getServiceEndpointStats } from "./generators/service-generator";
import type { OpenApiK6GeneratorOptions } from "./types";

/**
 * Main generator class for K6 API clients
 *
 * Generates type-safe K6 HTTP clients from OpenAPI specifications
 * with TypeScript types for request/response handling.
 */
export class OpenApiK6Generator implements Generator {
	private readonly options: OpenApiK6GeneratorOptions;
	private spec: OpenAPISpec | null = null;
	private static specCache = new LRUCache<string, OpenAPISpec>(50);

	constructor(options: OpenApiK6GeneratorOptions) {
		// Validate required options
		if (!options.input) {
			throw new FileOperationError("Input path is required", "");
		}

		if (!existsSync(options.input)) {
			throw new FileOperationError(`Input file not found: ${options.input}`, options.input);
		}

		if (!options.outputTypes) {
			throw new K6ClientGenerationError("Output types path is required");
		}

		if (!options.outputClient) {
			throw new K6ClientGenerationError("Output client path is required");
		}

		this.options = {
			includeDescriptions: options.includeDescriptions ?? true,
			showStats: options.showStats ?? true,
			...options,
		};
	}

	/**
	 * Parse the OpenAPI specification file
	 */
	private parseSpec(): OpenAPISpec {
		if (this.spec) return this.spec;

		// Use core utility with caching
		this.spec = loadOpenAPISpecCached(this.options.input, OpenApiK6Generator.specCache);
		return this.spec;
	}

	/**
	 * Ensure directory exists for a file path
	 */
	private ensureDirectoryExists(filePath: string): void {
		const normalizedPath = normalize(filePath);
		const dir = dirname(normalizedPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}

	/**
	 * Generate the K6 client as a string
	 * @returns The generated K6 client TypeScript code
	 */
	generateString(): string {
		const spec = this.parseSpec();
		return generateK6ClientCode(spec, this.options);
	}

	/**
	 * Generate parameter types (Params/Headers interfaces) as a string
	 * @returns The generated TypeScript interface code for K6 client parameters
	 */
	generateParamTypesString(): string {
		const spec = this.parseSpec();
		return generateK6TypesCode(spec, this.options);
	}

	/**
	 * Generate TypeScript types as a string (using openapi-to-typescript)
	 * This generates schema types from OpenAPI components
	 * @returns The generated TypeScript types code
	 */
	generateSchemaTypesString(): string {
		const typescriptGenerator = new TypeScriptGenerator({
			input: this.options.input,
			outputTypes: this.options.outputTypes,
			includeDescriptions: this.options.includeDescriptions,
			prefix: this.options.prefix,
			suffix: this.options.suffix,
			stripSchemaPrefix: this.options.stripSchemaPrefix,
			useOperationId: this.options.useOperationId,
			defaultNullable: this.options.defaultNullable,
			enumFormat: "union",
		});

		return typescriptGenerator.generateString();
	}

	/**
	 * Generate K6 service as a string
	 * @param clientImportPath - Relative import path for the client
	 * @param typesImportPath - Relative import path for types
	 * @returns The generated K6 service TypeScript code
	 */
	generateServiceString(clientImportPath: string, typesImportPath: string): string {
		const spec = this.parseSpec();
		return generateK6ServiceCode(spec, this.options, clientImportPath, typesImportPath);
	}

	/**
	 * Compute relative import path from service file to client file
	 */
	private computeClientImportPath(): string {
		if (!this.options.outputService) return "";

		const serviceDir = dirname(normalize(this.options.outputService));
		const clientPath = normalize(this.options.outputClient);

		let relativePath = relative(serviceDir, clientPath);

		// Remove .ts extension
		relativePath = relativePath.replace(/\.ts$/, "");

		// Ensure it starts with ./ or ../
		if (!relativePath.startsWith(".") && !relativePath.startsWith("..")) {
			relativePath = `./${relativePath}`;
		}

		// Normalize path separators for import
		return relativePath.replace(/\\/g, "/");
	}

	/**
	 * Compute relative import path from service file to types file
	 */
	private computeServiceTypesImportPath(): string {
		if (!this.options.outputService) return "";

		const serviceDir = dirname(normalize(this.options.outputService));
		const typesPath = normalize(this.options.outputTypes);

		let relativePath = relative(serviceDir, typesPath);

		// Remove .ts extension
		relativePath = relativePath.replace(/\.ts$/, "");

		// Ensure it starts with ./ or ../
		if (!relativePath.startsWith(".") && !relativePath.startsWith("..")) {
			relativePath = `./${relativePath}`;
		}

		// Normalize path separators for import
		return relativePath.replace(/\\/g, "/");
	}

	/**
	 * Generate and write output files
	 */
	generate(): void {
		try {
			const spec = this.parseSpec();
			const normalizedClientOutput = normalize(this.options.outputClient);

			// Generate header
			const header = this.generateFileHeader(spec);

			// Determine if we're using separate types file
			const useSeparateTypes = !!this.options.outputTypes;

			// If outputTypes is specified, generate types to separate file
			if (useSeparateTypes) {
				const normalizedTypesOutput = normalize(this.options.outputTypes);

				// Generate K6 param types (interfaces)
				const paramTypesCode = this.generateParamTypesString();

				// Generate schema types from openapi-to-typescript
				const schemaTypesCode = this.generateSchemaTypesString();

				// Combine both types files
				const combinedTypesCode = schemaTypesCode + (paramTypesCode ? `\n${paramTypesCode}` : "");

				if (combinedTypesCode.trim()) {
					this.ensureDirectoryExists(normalizedTypesOutput);
					writeFileSync(normalizedTypesOutput, header + combinedTypesCode, "utf-8");
					console.log(`  ✓ Generated types: ${normalizedTypesOutput}`);
				}
			}

			// Generate K6 client (with import path if using separate types)
			const clientCode = generateK6ClientCode(spec, this.options);

			if (!clientCode) {
				console.warn("⚠️  No output generated - no operations found after filtering");
				return;
			}

			// Write main client file
			this.ensureDirectoryExists(normalizedClientOutput);
			writeFileSync(normalizedClientOutput, header + clientCode, "utf-8");
			console.log(`  ✓ Generated K6 client: ${normalizedClientOutput}`);

			// Show client stats if enabled
			if (this.options.showStats) {
				const stats = getEndpointStats(spec, this.options);
				console.log(`    Paths: ${stats.totalPaths}, Operations: ${stats.includedOperations}/${stats.totalOperations}`);
			}

			// Generate K6 service if outputService is specified
			if (this.options.outputService) {
				const normalizedServiceOutput = normalize(this.options.outputService);
				const clientImportPath = this.computeClientImportPath();
				const serviceTypesImportPath = this.computeServiceTypesImportPath();

				const serviceCode = this.generateServiceString(clientImportPath, serviceTypesImportPath);

				if (serviceCode) {
					this.ensureDirectoryExists(normalizedServiceOutput);
					writeFileSync(normalizedServiceOutput, header + serviceCode, "utf-8");
					console.log(`  ✓ Generated K6 service: ${normalizedServiceOutput}`);

					// Show service stats if enabled
					if (this.options.showStats) {
						const serviceStats = getServiceEndpointStats(spec, this.options);
						console.log(`    Service methods: ${serviceStats.includedOperations}`);
					}
				}
			}
		} catch (error) {
			throw new K6ClientGenerationError(
				`Failed to generate K6 client: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Generate file header comment
	 */
	private generateFileHeader(spec: OpenAPISpec): string {
		const lines = ["// Auto-generated by @cerios/openapi-to-k6", "// Do not edit this file manually", ""];

		if (spec.info) {
			if (spec.info.title) {
				lines.splice(1, 0, `// API: ${spec.info.title}`);
			}
			if (spec.info.version) {
				lines.splice(2, 0, `// Version: ${spec.info.version}`);
			}
		}

		return lines.join("\n");
	}
}
