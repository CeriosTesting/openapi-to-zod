import { z } from "zod";

/**
 * Zod schema for request/response options validation
 */
export const RequestResponseOptionsSchema = z.strictObject({
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	useDescribe: z.boolean().optional(),
	includeDescriptions: z.boolean().optional(),
	defaultNullable: z.boolean().optional(),
	emptyObjectBehavior: z.enum(["strict", "loose", "record"]).optional(),
});

/**
 * Base Zod schema for operation filters (without status codes)
 * Packages can extend this with additional filters (e.g., status codes for Playwright/K6)
 */
export const OperationFiltersSchema = z.strictObject({
	includeTags: z.array(z.string()).optional(),
	excludeTags: z.array(z.string()).optional(),
	includePaths: z.array(z.string()).optional(),
	excludePaths: z.array(z.string()).optional(),
	includeMethods: z.array(z.string()).optional(),
	excludeMethods: z.array(z.string()).optional(),
	includeOperationIds: z.array(z.string()).optional(),
	excludeOperationIds: z.array(z.string()).optional(),
	excludeDeprecated: z.boolean().optional(),
});

/**
 * Regex pattern validator - used for customDateTimeFormatRegex
 */
export const RegexPatternSchema = z.union([
	z.string().refine(
		pattern => {
			try {
				new RegExp(pattern);
				return true;
			} catch {
				return false;
			}
		},
		{ message: "Must be a valid regular expression pattern" }
	),
	z.instanceof(RegExp),
]);

/**
 * Base generator options schema - shared across all packages
 *
 * Note: outputTypes is optional here to allow custom validation with friendly error messages.
 * Each package validates required fields separately.
 */
export const BaseGeneratorOptionsSchema = z.strictObject({
	input: z.string(),
	outputTypes: z.string().optional(),
	includeDescriptions: z.boolean().optional(),
	defaultNullable: z.boolean().optional(),
	stripSchemaPrefix: z.union([z.string(), z.array(z.string())]).optional(),
	stripPathPrefix: z.string().optional(),
	useOperationId: z.boolean().optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
	operationFilters: OperationFiltersSchema.optional(),
	showStats: z.boolean().optional(),
	cacheSize: z.number().positive().optional(),
	batchSize: z.number().positive().optional(),
	name: z.string().optional(),
});

/**
 * Base defaults schema (excludes input/output paths and name)
 * Used for the "defaults" section in config files
 */
export const BaseDefaultsSchema = BaseGeneratorOptionsSchema.omit({
	input: true,
	outputTypes: true,
	name: true,
});

/**
 * Execution mode schema - used by all packages
 */
export const ExecutionModeSchema = z.enum(["parallel", "sequential"]);

/**
 * Inferred TypeScript type for request/response options
 */
export type RequestResponseOptions = z.infer<typeof RequestResponseOptionsSchema>;

/**
 * Inferred TypeScript type for base operation filters
 */
export type BaseOperationFilters = z.infer<typeof OperationFiltersSchema>;

/**
 * Inferred TypeScript type for base generator options (input type with optional outputTypes)
 */
export type BaseGeneratorOptionsInput = z.infer<typeof BaseGeneratorOptionsSchema>;

/**
 * Inferred TypeScript type for base defaults
 */
export type BaseDefaultsInput = z.infer<typeof BaseDefaultsSchema>;

/**
 * Inferred TypeScript type for execution mode
 */
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;
