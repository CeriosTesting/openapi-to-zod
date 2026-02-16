import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, normalize, relative } from "node:path";

import type { Generator } from "@cerios/openapi-core";
import {
	ConfigurationError,
	FileOperationError,
	LRUCache,
	loadOpenAPISpecCached,
	toPascalCase,
	validateIgnorePatterns,
} from "@cerios/openapi-core";
import { TypeScriptGenerator } from "@cerios/openapi-to-typescript";
import type { OpenAPISpec } from "@cerios/openapi-to-zod";
import { OpenApiGenerator } from "@cerios/openapi-to-zod";

import { ClientGenerationError } from "./errors";
import { generateClientClass } from "./generators/client-generator";
import { generateInlineRequestSchemas, generateInlineResponseSchemas } from "./generators/inline-schema-generator";
import {
	collectInlineRequestSchemas,
	collectInlineResponseSchemas,
	generateServiceClass,
} from "./generators/service-generator";
import type { OpenApiPlaywrightGeneratorOptions } from "./types";

/**
 * Main generator class for Playwright API clients
 * Supports file splitting: schemas (always), client (optional), service (optional, requires client)
 */
export class OpenApiPlaywrightGenerator implements Generator {
	private options: OpenApiPlaywrightGeneratorOptions & { schemaType: "all" };
	private spec: OpenAPISpec | null = null;
	private schemasStringCache: string | null = null;
	private static specCache = new LRUCache<string, OpenAPISpec>(50); // Cache for parsed specs
	/** Separate schemas mode - when outputZodSchemas is specified */
	private separateSchemasMode: boolean;

	constructor(options: OpenApiPlaywrightGeneratorOptions) {
		// Input validation
		if (!options.input) {
			throw new FileOperationError("Input path is required", "");
		}

		if (!existsSync(options.input)) {
			throw new FileOperationError(`Input file not found: ${options.input}`, options.input);
		}

		// Determine if we're in separate schemas mode
		this.separateSchemasMode = Boolean(options.outputZodSchemas);

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
	 * - Types file (outputTypes): TypeScript type definitions
	 * - Schemas file (outputZodSchemas): Zod schemas with z.ZodType<TypeAlias> (when separate mode)
	 * - Combined file (outputTypes without outputZodSchemas): Zod schemas + inferred types
	 * - Client file: Always generated (outputClient is required)
	 * - Service file: Optional, generated when outputService is specified
	 */
	generate(): void {
		try {
			const { outputTypes: output, outputZodSchemas, outputClient, outputService } = this.options;

			// Ensure spec is parsed
			if (!this.spec) {
				this.spec = this.parseSpec();
			}

			// Normalize paths for cross-platform compatibility
			const normalizedOutput = normalize(output);
			const normalizedZodSchemas = outputZodSchemas ? normalize(outputZodSchemas) : undefined;
			const normalizedClient = outputClient ? normalize(outputClient) : undefined;
			const normalizedService = outputService ? normalize(outputService) : undefined;

			// Determine which file contains the schemas for service imports
			const schemasFile = normalizedZodSchemas || normalizedOutput;

			if (this.separateSchemasMode && normalizedZodSchemas) {
				// Generate TypeScript types to outputTypes
				const typesString = this.generateTypesString();
				this.ensureDirectoryExists(normalizedOutput);
				writeFileSync(normalizedOutput, typesString, "utf-8");
				console.log(`  ✓ Generated ${normalizedOutput}`);

				// Generate Zod schemas to outputZodSchemas
				const schemasString = this.generateSchemasString();
				this.ensureDirectoryExists(normalizedZodSchemas);
				writeFileSync(normalizedZodSchemas, schemasString, "utf-8");
				console.log(`  ✓ Generated ${normalizedZodSchemas}`);
			} else {
				// Original behavior: combined schemas and types in one file
				const schemasString = this.generateSchemasString();
				this.ensureDirectoryExists(normalizedOutput);
				writeFileSync(normalizedOutput, schemasString, "utf-8");
				console.log(`  ✓ Generated ${normalizedOutput}`);
			}

			// Conditionally generate client
			if (normalizedClient) {
				const clientOutput = this.generateClientFile();
				this.ensureDirectoryExists(normalizedClient);
				writeFileSync(normalizedClient, clientOutput, "utf-8");
				console.log(`  ✓ Generated ${normalizedClient}`);
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
				// Service imports schemas from the schemas file
				// In separate mode, types come from the types file (normalizedOutput)
				const typesFile = this.separateSchemasMode ? normalizedOutput : schemasFile;
				const serviceOutput = this.generateServiceFile(normalizedService, schemasFile, normalizedClient, typesFile);
				this.ensureDirectoryExists(normalizedService);
				writeFileSync(normalizedService, serviceOutput, "utf-8");
				console.log(`  ✓ Generated ${normalizedService}`);
			}
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
		if (this.schemasStringCache !== null) {
			return this.schemasStringCache;
		}

		// Ensure spec is parsed
		if (!this.spec) {
			this.spec = this.parseSpec();
		}

		// Validate ignoreHeaders patterns and warn about issues
		if (this.options.ignoreHeaders) {
			validateIgnorePatterns(this.options.ignoreHeaders, this.spec, "openapi-to-zod-playwright");
		}

		const schemaGeneratorOptions = { ...this.options };
		const schemaGenerator = new OpenApiGenerator(schemaGeneratorOptions);
		let schemasString = schemaGenerator.generateString();

		// Common options for inline schema generation
		const inlineSchemaOptions = {
			spec: this.spec,
			prefix: this.options.prefix || "",
			suffix: this.options.suffix || "",
			mode: this.options.mode,
			includeDescriptions: this.options.includeDescriptions,
			useDescribe: this.options.useDescribe,
			stripSchemaPrefix: this.options.stripSchemaPrefix,
			defaultNullable: this.options.defaultNullable,
			emptyObjectBehavior: this.options.emptyObjectBehavior,
			// Skip type inference when in separate schemas mode (types come from separate file)
			skipTypeInference: this.separateSchemasMode,
		};

		// Collect inline schemas
		const inlineRequestSchemas = collectInlineRequestSchemas(
			this.spec,
			this.options.useOperationId ?? false,
			this.options.operationFilters,
			this.options.ignoreHeaders,
			this.options.stripPathPrefix,
			this.options.preferredContentTypes
		);

		const inlineResponseSchemas = collectInlineResponseSchemas(
			this.spec,
			this.options.useOperationId ?? false,
			this.options.operationFilters,
			this.options.ignoreHeaders,
			this.options.stripPathPrefix,
			this.options.preferredContentTypes
		);

		// Generate inline request schemas first (alphabetically before response schemas)
		if (inlineRequestSchemas.size > 0) {
			const inlineRequestSchemasCode = generateInlineRequestSchemas(inlineRequestSchemas, inlineSchemaOptions);

			if (inlineRequestSchemasCode.trim()) {
				schemasString += "\n\n";
				schemasString += inlineRequestSchemasCode;
			}
		}

		// Generate inline response schemas
		if (inlineResponseSchemas.size > 0) {
			const inlineResponseSchemasCode = generateInlineResponseSchemas(inlineResponseSchemas, inlineSchemaOptions);

			if (inlineResponseSchemasCode.trim()) {
				schemasString += "\n\n";
				schemasString += inlineResponseSchemasCode;
			}
		}

		this.schemasStringCache = schemasString;
		return this.schemasStringCache;
	}

	/**
	 * Generate TypeScript types as a string (for outputZodSchemas mode)
	 * Uses @cerios/openapi-to-typescript internally
	 * @returns The generated TypeScript types code
	 */
	generateTypesString(): string {
		const tsGenerator = new TypeScriptGenerator({
			input: this.options.input,
			outputTypes: this.options.outputTypes,
			includeDescriptions: this.options.includeDescriptions,
			defaultNullable: this.options.defaultNullable,
			prefix: this.options.prefix,
			suffix: this.options.suffix,
			stripSchemaPrefix: this.options.stripSchemaPrefix,
			stripPathPrefix: this.options.stripPathPrefix,
			operationFilters: this.options.operationFilters,
			showStats: this.options.showStats,
			enumFormat: this.options.enumFormat ?? "const-object",
			useOperationId: this.options.useOperationId ?? false,
		});

		return tsGenerator.generateString();
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

		const clientClassName = this.deriveClassName(this.options.outputClient, "Client");
		return generateClientClass(
			this.spec,
			clientClassName,
			this.options.basePath,
			this.options.operationFilters,
			this.options.useOperationId ?? false,
			this.options.stripPathPrefix
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
		const serviceClassName = this.deriveClassName(this.options.outputService || this.options.outputClient, "Service");
		const clientClassName = this.deriveClassName(this.options.outputClient, "Client");
		return generateServiceClass(
			this.spec,
			schemaImports,
			serviceClassName,
			clientClassName,
			this.options.useOperationId ?? false,
			this.options.operationFilters,
			this.options.ignoreHeaders,
			this.options.stripPathPrefix,
			this.options.stripSchemaPrefix,
			this.options.preferredContentTypes,
			this.options.prefix,
			this.options.suffix,
			this.options.fallbackContentTypeParsing,
			this.options.validateServiceRequest ?? false,
			this.options.zodErrorFormat ?? "standard"
		);
	}

	/**
	 * Parse the OpenAPI specification file with caching
	 * Enhanced with error context for better debugging
	 */
	private parseSpec(): OpenAPISpec {
		// Use core utility with caching
		const spec = loadOpenAPISpecCached(this.options.input, OpenApiPlaywrightGenerator.specCache) as OpenAPISpec;
		return spec;
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
	 * @param servicePath - Path to the service file being generated
	 * @param schemasPath - Path to the schemas file (for schema value imports)
	 * @param clientPath - Path to the client file
	 * @param typesPath - Path to the types file (for type imports, defaults to schemasPath in combined mode)
	 */
	private generateServiceFile(
		servicePath: string,
		schemasPath: string,
		clientPath: string,
		typesPath?: string
	): string {
		const serviceString = this.generateServiceString();
		const relativeImportSchemas = this.generateRelativeImport(servicePath, schemasPath);
		const relativeImportClient = this.generateRelativeImport(servicePath, clientPath);

		// In separate schemas mode, types come from a different file
		// If typesPath is not provided, default to schemasPath (combined mode)
		const effectiveTypesPath = typesPath ?? schemasPath;
		const isSeparateMode = effectiveTypesPath !== schemasPath;
		const relativeImportTypes = isSeparateMode
			? this.generateRelativeImport(servicePath, effectiveTypesPath)
			: relativeImportSchemas;

		// Derive the client class name from the client file path
		const clientClassName = this.deriveClassName(clientPath, "Client");

		// Extract schema names from schemas file
		const allSchemas = this.extractSchemaNames();

		// Schemas ending with "Schema" are used as values for .parse()
		const schemaValues = allSchemas.filter(name => name.endsWith("Schema") && serviceString.includes(name));

		// For types in separate mode, extract from types file
		// For types in combined mode, extract from schemas file (same as before)
		let schemaTypes: string[];
		if (isSeparateMode) {
			// Extract types from the types file
			const typeNames = this.extractTypeNamesFromTypesFile();
			schemaTypes = typeNames.filter(name => {
				if (!serviceString.includes(name)) return false;
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
		} else {
			// Combined mode - types come from schemas file
			schemaTypes = allSchemas.filter(name => {
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
		}

		const output: string[] = [];

		// Add statistics if enabled
		if (this.options.showStats === true) {
			output.push(...this.generateServiceStats(schemaValues.length, schemaTypes.length));
			output.push("");
		}

		// Build import statements - schemas and types may come from different files
		let schemaImportStatement = "";
		if (schemaValues.length > 0) {
			schemaImportStatement += `import { ${schemaValues.join(", ")} } from "${relativeImportSchemas}";\n`;
		}

		let typeImportStatement = "";
		if (schemaTypes.length > 0) {
			typeImportStatement = `import type { ${schemaTypes.join(", ")} } from "${relativeImportTypes}";\n`;
		}

		// Check for type aliases that are needed from the runtime package
		// These are now exported from @cerios/openapi-to-zod-playwright
		const runtimeTypeAliases = [
			"ApiRequestContextOptions",
			"MultipartFormValue",
			"QueryParams",
			"HttpHeaders",
			"UrlEncodedFormData",
			"MultipartFormData",
			"RequestBody",
		];

		const runtimeTypeImports: string[] = [];
		for (const typeAlias of runtimeTypeAliases) {
			// Use word boundary regex to avoid matching partial strings
			const regex = new RegExp(`\\b${typeAlias}\\b`);
			if (regex.test(serviceString)) {
				runtimeTypeImports.push(typeAlias);
			}
		}

		// Client import - only the class name
		const clientImports = [clientClassName];

		// Only import z from zod if it's actually used for inline schemas
		// Note: prettify helpers are now imported from the package, not using z directly
		const zodUsagePattern = /\bz\.(string|number|boolean|array|object|parse)\(/;
		if (zodUsagePattern.test(serviceString)) {
			output.push(`import { z } from "zod";`);
		}
		output.push(`import { expect } from "@playwright/test";`);

		// Check if service already has package import (from zodErrorFormat helpers like parseWithPrettifyError)
		const existingPackageImportMatch = serviceString.match(
			/import\s+\{\s*([^}]+)\s*\}\s+from\s+["']@cerios\/openapi-to-zod-playwright["']/
		);

		// Collect value imports (like parseWithPrettifyError) from existing service string
		const valueImports: string[] = [];
		if (existingPackageImportMatch) {
			const existingImports = existingPackageImportMatch[1].split(",").map(s => s.trim());
			valueImports.push(...existingImports);
		}

		// Add value imports if any
		if (valueImports.length > 0) {
			output.push(`import { ${valueImports.join(", ")} } from "@cerios/openapi-to-zod-playwright";`);
		}

		// Add runtime type imports (these are always type-only imports)
		if (runtimeTypeImports.length > 0) {
			output.push(`import type { ${runtimeTypeImports.join(", ")} } from "@cerios/openapi-to-zod-playwright";`);
		}

		output.push(`import { ${clientImports.join(", ")} } from "${relativeImportClient}";`);
		if (schemaImportStatement) {
			output.push(schemaImportStatement.trim());
		}
		if (typeImportStatement) {
			output.push(typeImportStatement.trim());
		}
		output.push("");

		// Remove the existing package import from service string if present (we already added it above)
		let cleanedServiceString = serviceString;
		if (existingPackageImportMatch) {
			cleanedServiceString = serviceString.replace(
				/import\s+\{\s*[^}]+\s*\}\s+from\s+["']@cerios\/openapi-to-zod-playwright["'];\n?/,
				""
			);
		}

		output.push(cleanedServiceString);

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
	 * Extract type names from generated types file (for separate schemas mode)
	 * This extracts types from the TypeScript types file (generated by openapi-to-typescript)
	 */
	private extractTypeNamesFromTypesFile(): string[] {
		// In separate mode, types come from generateTypesString()
		const typesString = this.generateTypesString();
		const names = new Set<string>();

		// Match export type X = ...
		const typeRegex = /export type (\w+)\s*=/g;
		let match = typeRegex.exec(typesString);
		while (match !== null) {
			names.add(match[1]);
			match = typeRegex.exec(typesString);
		}

		// Match const object pattern: export const X = { ... } as const; export type X = ...
		// These generate both a const and a type with the same name (for enums)
		const constObjectRegex = /export const (\w+)\s*=\s*\{[^}]*\}\s*as\s*const/g;
		match = constObjectRegex.exec(typesString);
		while (match !== null) {
			names.add(match[1]);
			match = constObjectRegex.exec(typesString);
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
