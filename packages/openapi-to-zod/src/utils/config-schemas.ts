import { z } from "zod";

/**
 * @shared Zod schema for request/response options validation
 * @since 1.0.0
 * Utility used by core and playwright packages
 */
export const RequestResponseOptionsSchema = z.strictObject({
	mode: z.enum(["strict", "normal", "loose"]).optional(),
	useDescribe: z.boolean().optional(),
	includeDescriptions: z.boolean().optional(),
	defaultNullable: z.boolean().optional(),
	emptyObjectBehavior: z.enum(["strict", "loose", "record"]).optional(),
});

/**
 * @shared Base Zod schema for operation filters (without status codes)
 * @since 1.0.0
 * Utility used by core and playwright packages
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
 * Inferred TypeScript type for request/response options
 */
export type RequestResponseOptions = z.infer<typeof RequestResponseOptionsSchema>;

/**
 * Inferred TypeScript type for base operation filters
 */
export type BaseOperationFilters = z.infer<typeof OperationFiltersSchema>;
