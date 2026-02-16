/**
 * OpenAPI specification parsing utilities
 *
 * Provides centralized parsing for OpenAPI specs with proper error handling.
 * Supports both YAML and JSON formats with automatic detection.
 */

import { existsSync, readFileSync } from "node:fs";

import { parse as parseYaml } from "yaml";

import { FileOperationError, SpecValidationError } from "../errors";
import type { OpenAPISpec } from "../types";

import { LRUCache } from "./lru-cache";

/**
 * Options for parsing OpenAPI specifications
 */
export interface ParseOpenAPISpecOptions {
	/**
	 * Whether to validate that the spec has required OpenAPI fields
	 * @default true
	 */
	validate?: boolean;
}

/**
 * Parse an OpenAPI specification from a string
 *
 * Attempts YAML parsing first (works for both YAML and JSON),
 * then falls back to JSON parsing if YAML fails.
 *
 * @param content - The specification content as a string
 * @param sourcePath - The source file path (for error messages)
 * @param options - Parsing options
 * @returns Parsed OpenAPI specification
 * @throws SpecValidationError if parsing fails or spec is invalid
 * @internal
 */
function parseOpenAPISpecFromString(
	content: string,
	sourcePath = "<string>",
	options: ParseOpenAPISpecOptions = {}
): OpenAPISpec {
	const { validate = true } = options;

	let spec: OpenAPISpec;

	try {
		spec = parseYaml(content) as OpenAPISpec;
	} catch (yamlError) {
		// If YAML parsing fails, try JSON
		try {
			spec = JSON.parse(content) as OpenAPISpec;
		} catch {
			if (yamlError instanceof Error) {
				const errorMessage = [
					`Failed to parse OpenAPI specification from: ${sourcePath}`,
					"",
					`Error: ${yamlError.message}`,
					"",
					"Please ensure:",
					"  - The file contains valid YAML or JSON syntax",
					"  - The file is a valid OpenAPI 3.x specification",
				].join("\n");
				throw new SpecValidationError(errorMessage, {
					filePath: sourcePath,
					originalError: yamlError.message,
				});
			}
			throw yamlError;
		}
	}

	// Validate spec has required fields
	if (validate) {
		if (!spec.openapi && !(spec as Record<string, unknown>).swagger) {
			throw new SpecValidationError(
				`Invalid OpenAPI specification: missing 'openapi' or 'swagger' field in ${sourcePath}`,
				{ filePath: sourcePath }
			);
		}
	}

	return spec;
}

/**
 * Load and parse an OpenAPI specification from a file
 *
 * @param inputPath - Path to the OpenAPI specification file
 * @param options - Parsing options
 * @returns Parsed OpenAPI specification
 * @throws FileOperationError if file doesn't exist or can't be read
 * @throws SpecValidationError if parsing fails or spec is invalid
 */
export function loadOpenAPISpec(inputPath: string, options: ParseOpenAPISpecOptions = {}): OpenAPISpec {
	// Validate input file exists
	if (!existsSync(inputPath)) {
		throw new FileOperationError(`Input file not found: ${inputPath}`, inputPath);
	}

	let content: string;
	try {
		content = readFileSync(inputPath, "utf-8");
	} catch (error) {
		if (error instanceof Error) {
			const errorMessage = [
				`Failed to read OpenAPI specification from: ${inputPath}`,
				"",
				`Error: ${error.message}`,
			].join("\n");
			throw new FileOperationError(errorMessage, inputPath, { originalError: error.message });
		}
		throw error;
	}

	return parseOpenAPISpecFromString(content, inputPath, options);
}

/**
 * Load and parse an OpenAPI specification with caching
 *
 * Uses an LRU cache to avoid re-parsing the same specification multiple times.
 * Useful for generators that process the same spec in multiple passes.
 *
 * @param inputPath - Path to the OpenAPI specification file
 * @param cache - LRU cache instance for storing parsed specs
 * @param options - Parsing options
 * @returns Parsed OpenAPI specification
 */
export function loadOpenAPISpecCached(
	inputPath: string,
	cache: LRUCache<string, OpenAPISpec>,
	options: ParseOpenAPISpecOptions = {}
): OpenAPISpec {
	const cached = cache.get(inputPath);
	if (cached) {
		return cached;
	}

	const spec = loadOpenAPISpec(inputPath, options);
	cache.set(inputPath, spec);
	return spec;
}
