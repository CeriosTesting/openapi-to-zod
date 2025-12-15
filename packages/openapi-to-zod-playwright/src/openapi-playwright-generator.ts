import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, normalize, relative } from "node:path";
import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import { OpenApiGenerator } from "@cerios/openapi-to-zod";
import { parse } from "yaml";
import { ClientGenerationError, ConfigurationError, FileOperationError, SpecValidationError } from "./errors";
import { generateClientClass } from "./generators/client-generator";
import { generateServiceClass } from "./generators/service-generator";
import type { OpenApiPlaywrightGeneratorOptions } from "./types";
import { LRUCache } from "./utils/lru-cache";
import { toPascalCase } from "./utils/string-utils";

/**
 * Main generator class for Playwright API clients
 * Supports file splitting: schemas (always), client (optional), service (optional, requires client)
 */
export class OpenApiPlaywrightGenerator {
	private options: OpenApiPlaywrightGeneratorOptions & { schemaType: "all" };
	private spec: OpenAPISpec | null = null;
	private static specCache = new LRUCache<string, OpenAPISpec>(50); // Cache for parsed specs

	constructor(options: OpenApiPlaywrightGeneratorOptions) {
		// Input validation
		if (!options.input) {
			throw new FileOperationError("Input path is required", "");
		}

		if (!existsSync(options.input)) {
			throw new FileOperationError(`Input file not found: ${options.input}`, options.input);
		}

		this.options = {
			mode: options.mode || "normal",
			includeDescriptions: options.includeDescriptions ?? true,
			useDescribe: options.useDescribe ?? false,
			showStats: options.showStats ?? true,
			prefix: options.prefix || "",
			suffix: options.suffix || "",
			useOperationId: options.useOperationId ?? false, // Default to false
			...options,
			schemaType: "all", // Always enforce all schemas
		};
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
	 * Generate output files with mandatory file splitting
	 * - Main file: Always contains schemas and types
	 * - Client file: Optional, generated when outputClient is specified
	 * - Service file: Optional, generated when outputService is specified (requires outputClient)
	 */
	generate(): void {
		if (!this.options.output) {
			throw new FileOperationError(
				"Output path is required when calling generate(). " +
					"Either provide an 'output' option or use generateString() to get the result as a string.",
				""
			);
		}

		// Validation: service requires client
		if (this.options.outputService && !this.options.outputClient) {
			throw new ConfigurationError(
				"Service generation requires client. Service class depends on client class for API calls. " +
					"Please specify outputClient path when using outputService.",
				{
					outputService: this.options.outputService,
					outputClient: undefined,
				}
			);
		}

		console.log(`Generating Playwright client for ${this.options.input}...`);

		try {
			const { output, outputClient, outputService } = this.options;

			// Ensure spec is parsed
			if (!this.spec) {
				this.spec = this.parseSpec();
			}

			// Normalize paths for cross-platform compatibility
			const normalizedOutput = normalize(output);
			const normalizedClient = outputClient ? normalize(outputClient) : undefined;
			const normalizedService = outputService ? normalize(outputService) : undefined;

			// Always generate schemas
			const schemasString = this.generateSchemasString();
			this.ensureDirectoryExists(normalizedOutput);
			writeFileSync(normalizedOutput, schemasString, "utf-8");

			let generatedComponents = "schemas";

			// Conditionally generate client
			if (normalizedClient) {
				const clientOutput = this.generateClientFile();
				this.ensureDirectoryExists(normalizedClient);
				writeFileSync(normalizedClient, clientOutput, "utf-8");
				generatedComponents += " + client";
				console.log(`✓ Generated ${normalizedClient}`);
			}

			// Conditionally generate service (validation already ensures outputClient exists)
			if (normalizedService) {
				// TypeScript doesn't know validation ensures normalizedClient exists, so we check explicitly
				if (!normalizedClient) {
					throw new ConfigurationError("Service generation requires client. This should have been caught earlier.", {
						outputService,
						outputClient: undefined,
					});
				}
				const serviceOutput = this.generateServiceFile(normalizedService, normalizedOutput, normalizedClient);
				this.ensureDirectoryExists(normalizedService);
				writeFileSync(normalizedService, serviceOutput, "utf-8");
				generatedComponents += " + service";
				console.log(`✓ Generated ${normalizedService}`);
			}

			console.log(`✓ Generated ${normalizedOutput} (${generatedComponents})`);
		} catch (error) {
			throw new ClientGenerationError(
				`Failed to generate Playwright client: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
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

		const schemaGenerator = new OpenApiGenerator(this.options);
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

		const clientClassName = this.deriveClassName(this.options.outputClient || this.options.output, "Client");
		return generateClientClass(
			this.spec,
			clientClassName,
			this.options.basePath,
			this.options.operationFilters,
			this.options.useOperationId ?? false
		);
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
		const serviceClassName = this.deriveClassName(this.options.outputService || this.options.output, "Service");
		const clientClassName = this.deriveClassName(this.options.outputClient || this.options.output, "Client");
		return generateServiceClass(
			this.spec,
			schemaImports,
			serviceClassName,
			clientClassName,
			this.options.useOperationId ?? false,
			this.options.operationFilters
		);
	}

	/**
	 * Parse the OpenAPI specification file with caching
	 * Enhanced with error context for better debugging
	 */
	private parseSpec(): OpenAPISpec {
		// Check cache first for performance
		const cached = OpenApiPlaywrightGenerator.specCache.get(this.options.input);
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
			OpenApiPlaywrightGenerator.specCache.set(this.options.input, spec);
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
	 * Generate client file with proper imports and statistics
	 */
	private generateClientFile(): string {
		const clientString = this.generateClientString();

		const output: string[] = [];

		// Add statistics if enabled
		if (this.options.showStats === true) {
			output.push(...this.generateClientStats());
			output.push("");
		}

		// Client is a passthrough and doesn't need schema imports
		output.push(`import type { APIRequestContext, APIResponse } from "@playwright/test";`);
		output.push(clientString);

		return output.join("\n");
	}

	/**
	 * Generate service file with proper imports and statistics
	 */
	private generateServiceFile(servicePath: string, mainPath: string, clientPath: string): string {
		const serviceString = this.generateServiceString();
		const relativeImportMain = this.generateRelativeImport(servicePath, mainPath);
		const relativeImportClient = this.generateRelativeImport(servicePath, clientPath);

		// Derive the client class name from the client file path
		const clientClassName = this.deriveClassName(clientPath, "Client");

		// Extract schema/type names and filter to only those used in service
		const allSchemas = this.extractSchemaNames();

		// Schemas ending with "Schema" are used as values for .parse()
		const schemaValues = allSchemas.filter(name => name.endsWith("Schema") && serviceString.includes(name));

		// For types, import those used in:
		// 1. Return type annotations: Promise<TypeName>
		// 2. Parameter types (e.g., request bodies): data: TypeName
		// 3. Query parameter types: params?: TypeName
		// 4. Header parameter types: headers?: TypeName
		const schemaTypes = allSchemas.filter(name => {
			if (name.endsWith("Schema")) return false; // Skip schemas
			if (!serviceString.includes(name)) return false; // Must appear in the code
			// Match return types, parameter types, query param types, or header param types
			const returnPattern = new RegExp(`Promise<${name}(?:\\[\\])?>`);
			const paramPattern = new RegExp(`(?:data|form|multipart)\\??:\\s*${name}\\b`);
			const queryParamPattern = new RegExp(`params\\??:\\s*${name}\\b`);
			const headerParamPattern = new RegExp(`headers\\??:\\s*${name}\\b`);
			return (
				returnPattern.test(serviceString) ||
				paramPattern.test(serviceString) ||
				queryParamPattern.test(serviceString) ||
				headerParamPattern.test(serviceString)
			);
		});

		const output: string[] = [];

		// Add statistics if enabled
		if (this.options.showStats === true) {
			output.push(...this.generateServiceStats(schemaValues.length, schemaTypes.length));
			output.push("");
		}

		let schemaImportStatement = "";
		if (schemaValues.length > 0) {
			schemaImportStatement += `import { ${schemaValues.join(", ")} } from "${relativeImportMain}";\n`;
		}
		if (schemaTypes.length > 0) {
			schemaImportStatement += `import type { ${schemaTypes.join(", ")} } from "${relativeImportMain}";\n`;
		}

		// Only import ApiRequestContextOptions/MultipartFormValue if service uses them
		const usesOptions = serviceString.includes("ApiRequestContextOptions");
		const usesMultipart = serviceString.includes("MultipartFormValue");
		const clientImports = [clientClassName];
		if (usesOptions) clientImports.push("type ApiRequestContextOptions");
		if (usesMultipart) clientImports.push("type MultipartFormValue");

		output.push(`import { z } from "zod";`);
		output.push(`import { expect } from "@playwright/test";`);
		output.push(`import { ${clientImports.join(", ")} } from "${relativeImportClient}";`);
		if (schemaImportStatement) {
			output.push(schemaImportStatement.trim());
		}
		output.push("");
		output.push(serviceString);

		return output.join("\n");
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

	/**
	 * Generate statistics for client file
	 */
	private generateClientStats(): string[] {
		if (!this.spec) {
			this.spec = this.parseSpec();
		}

		const endpoints = this.extractEndpointsFromSpec();
		const httpMethodCounts = new Map<string, number>();
		const pathParams = new Set<string>();

		for (const endpoint of endpoints) {
			const method = endpoint.method.toUpperCase();
			httpMethodCounts.set(method, (httpMethodCounts.get(method) || 0) + 1);
			for (const param of endpoint.pathParams) {
				pathParams.add(param);
			}
		}

		// Sort methods alphabetically and format with counts
		const methodStats = Array.from(httpMethodCounts.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([method, count]) => `${method}: ${count}`)
			.join(", ");

		return [
			"// Auto-generated by @cerios/openapi-to-zod-playwright",
			"// Do not edit this file manually",
			"",
			"// Client Statistics:",
			`//   Total endpoints: ${endpoints.length}`,
			`//   HTTP methods: ${methodStats}`,
			`//   Unique path parameters: ${pathParams.size}`,
			`//   Generated at: ${new Date().toISOString()}`,
		];
	}

	/**
	 * Generate statistics for service file
	 */
	private generateServiceStats(schemaImports: number, typeImports: number): string[] {
		if (!this.spec) {
			this.spec = this.parseSpec();
		}

		const endpoints = this.extractEndpointsFromSpec();
		const withValidation = endpoints.filter(e => e.responses.some(r => r.schemaName)).length;
		const withQueryParams = endpoints.filter(e => e.queryParamSchemaName).length;

		return [
			"// Auto-generated by @cerios/openapi-to-zod-playwright",
			"// Do not edit this file manually",
			"",
			"// Service Statistics:",
			`//   Total methods: ${endpoints.length}`,
			`//   With response validation: ${withValidation}`,
			`//   With query parameters: ${withQueryParams}`,
			`//   Schema imports: ${schemaImports}`,
			`//   Type imports: ${typeImports}`,
			`//   Generated at: ${new Date().toISOString()}`,
		];
	}

	/**
	 * Extract endpoints from spec (helper for statistics)
	 */
	private extractEndpointsFromSpec(): Array<{
		path: string;
		method: string;
		methodName: string;
		pathParams: string[];
		queryParamSchemaName?: string;
		responses: Array<{ schemaName?: string }>;
	}> {
		if (!this.spec?.paths) return [];

		const endpoints: Array<{
			path: string;
			method: string;
			methodName: string;
			pathParams: string[];
			queryParamSchemaName?: string;
			responses: Array<{ schemaName?: string }>;
		}> = [];

		for (const [path, pathItem] of Object.entries(this.spec.paths)) {
			if (!pathItem) continue;

			const methods = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

			for (const method of methods) {
				const operation = pathItem[method];
				if (!operation) continue;

				// Extract path parameters
				const pathParams = (path.match(/\{([^}]+)\}/g) || []).map(p => p.slice(1, -1));

				// Check for query parameters
				const queryParamSchemaName = operation.parameters?.some(
					(p: any) => p.in === "query" || p.$ref?.includes("/parameters/")
				)
					? "queryParams"
					: undefined;

				// Extract response schemas
				const responses =
					operation.responses &&
					Object.values(operation.responses)
						.map((response: any) => {
							const content = response.content;
							if (!content) return { schemaName: undefined };

							const jsonContent = content["application/json"];
							if (!jsonContent?.schema?.$ref) return { schemaName: undefined };

							const refParts = jsonContent.schema.$ref.split("/");
							return { schemaName: refParts[refParts.length - 1] };
						})
						.filter(r => r.schemaName);

				endpoints.push({
					path,
					method,
					methodName: `${method}${path.replace(/\{[^}]+\}/g, "param")}`,
					pathParams,
					queryParamSchemaName,
					responses: responses || [],
				});
			}
		}

		return endpoints;
	}

	/**
	 * Derive a class name from an output file path
	 * Examples:
	 *   "api-client.ts" + "Client" -> "ApiClient"
	 *   "my-api-client.ts" + "Client" -> "MyApiClient"
	 *   "user-service.ts" + "Service" -> "UserService"
	 *   "tests/output/petstore.ts" + "Client" -> "PetstoreClient"
	 */
	private deriveClassName(filePath: string | undefined, suffix: "Client" | "Service"): string {
		if (!filePath) {
			return suffix === "Client" ? "ApiClient" : "ApiService";
		}

		// Extract filename without extension
		const fileName = basename(filePath, extname(filePath));

		// Remove common suffixes to avoid duplication (e.g., "api-client" -> "api")
		const baseName = fileName
			.replace(/-client$/i, "")
			.replace(/-service$/i, "")
			.replace(/client$/i, "")
			.replace(/service$/i, "");

		// Convert to PascalCase and append suffix
		const pascalName = toPascalCase(baseName);

		// If the name already ends with the suffix, don't duplicate
		if (pascalName.endsWith(suffix)) {
			return pascalName;
		}

		return `${pascalName}${suffix}`;
	}
}
