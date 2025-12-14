import { minimatch } from "minimatch";
import type { OperationFilters } from "../types";

/**
 * Filter statistics to track which operations were included/excluded
 */
export interface FilterStatistics {
	totalOperations: number;
	includedOperations: number;
	filteredByTags: number;
	filteredByPaths: number;
	filteredByMethods: number;
	filteredByOperationIds: number;
	filteredByDeprecated: number;
}

/**
 * Create a new filter statistics object with all counters initialized to zero
 */
export function createFilterStatistics(): FilterStatistics {
	return {
		totalOperations: 0,
		includedOperations: 0,
		filteredByTags: 0,
		filteredByPaths: 0,
		filteredByMethods: 0,
		filteredByOperationIds: 0,
		filteredByDeprecated: 0,
	};
}

/**
 * Check if a value matches any of the patterns (supports glob patterns)
 * Empty patterns array = no constraint (returns true)
 */
function matchesAnyPattern(value: string | undefined, patterns: string[] | undefined): boolean {
	if (!patterns || patterns.length === 0) {
		return false; // No constraint means "don't use this filter"
	}
	if (!value) {
		return false;
	}
	return patterns.some(pattern => minimatch(value, pattern));
}

/**
 * Check if an array contains any of the specified values
 * Empty values array = no constraint (returns false)
 */
function containsAny(arr: string[] | undefined, values: string[] | undefined): boolean {
	if (!values || values.length === 0) {
		return false; // No constraint means "don't use this filter"
	}
	if (!arr || arr.length === 0) {
		return false;
	}
	return values.some(value => arr.includes(value));
}

/**
 * Determine if an operation should be included based on filter criteria
 *
 * Filter logic:
 * 1. If no filters specified, include all operations
 * 2. Empty arrays are treated as "no constraint" (not as "exclude all")
 * 3. Include filters are applied first (allowlist)
 * 4. Exclude filters are applied second (blocklist)
 * 5. Exclude rules always win over include rules
 *
 * @param operation - The OpenAPI operation object
 * @param path - The operation path (e.g., "/users/{id}")
 * @param method - The HTTP method (e.g., "get", "post")
 * @param filters - Optional filter configuration
 * @param stats - Optional statistics object to track filtering reasons
 * @returns true if the operation should be included, false otherwise
 */
export function shouldIncludeOperation(
	operation: any,
	path: string,
	method: string,
	filters?: OperationFilters,
	stats?: FilterStatistics
): boolean {
	// If no filters specified, include all operations
	if (!filters) {
		return true;
	}

	const methodLower = method.toLowerCase();
	const operationId = operation?.operationId;
	const tags = operation?.tags || [];
	const deprecated = operation?.deprecated === true;

	// Apply include filters first (allowlist)
	// If any include filter is specified and the operation doesn't match, exclude it

	// Check includeTags
	if (filters.includeTags && filters.includeTags.length > 0) {
		if (!containsAny(tags, filters.includeTags)) {
			if (stats) stats.filteredByTags++;
			return false;
		}
	}

	// Check includePaths
	if (filters.includePaths && filters.includePaths.length > 0) {
		if (!matchesAnyPattern(path, filters.includePaths)) {
			if (stats) stats.filteredByPaths++;
			return false;
		}
	}

	// Check includeMethods
	if (filters.includeMethods && filters.includeMethods.length > 0) {
		const methodsLower = filters.includeMethods.map(m => m.toLowerCase());
		if (!methodsLower.includes(methodLower)) {
			if (stats) stats.filteredByMethods++;
			return false;
		}
	}

	// Check includeOperationIds
	if (filters.includeOperationIds && filters.includeOperationIds.length > 0) {
		if (!matchesAnyPattern(operationId, filters.includeOperationIds)) {
			if (stats) stats.filteredByOperationIds++;
			return false;
		}
	}

	// Apply exclude filters second (blocklist)
	// If the operation matches any exclude filter, exclude it

	// Check excludeDeprecated
	if (filters.excludeDeprecated === true && deprecated) {
		if (stats) stats.filteredByDeprecated++;
		return false;
	}

	// Check excludeTags
	if (filters.excludeTags && filters.excludeTags.length > 0) {
		if (containsAny(tags, filters.excludeTags)) {
			if (stats) stats.filteredByTags++;
			return false;
		}
	}

	// Check excludePaths
	if (filters.excludePaths && filters.excludePaths.length > 0) {
		if (matchesAnyPattern(path, filters.excludePaths)) {
			if (stats) stats.filteredByPaths++;
			return false;
		}
	}

	// Check excludeMethods
	if (filters.excludeMethods && filters.excludeMethods.length > 0) {
		const methodsLower = filters.excludeMethods.map(m => m.toLowerCase());
		if (methodsLower.includes(methodLower)) {
			if (stats) stats.filteredByMethods++;
			return false;
		}
	}

	// Check excludeOperationIds
	if (filters.excludeOperationIds && filters.excludeOperationIds.length > 0) {
		if (matchesAnyPattern(operationId, filters.excludeOperationIds)) {
			if (stats) stats.filteredByOperationIds++;
			return false;
		}
	}

	// Operation passed all filters
	return true;
}

/**
 * Validate filter statistics and emit warnings for filters that matched nothing
 * Helps users debug filter configurations that might be too restrictive or contain typos
 *
 * @param stats - Filter statistics object
 * @param filters - The filter configuration to validate
 */
export function validateFilters(stats: FilterStatistics, filters?: OperationFilters): void {
	if (!filters || stats.totalOperations === 0) {
		return;
	}

	// If all operations were filtered out, emit a warning
	if (stats.includedOperations === 0) {
		console.warn(
			`⚠️  Warning: All ${stats.totalOperations} operations were filtered out. Check your operationFilters configuration.`
		);

		// Provide specific guidance about which filters might be the issue
		const filterBreakdown: string[] = [];
		if (stats.filteredByTags > 0) filterBreakdown.push(`${stats.filteredByTags} by tags`);
		if (stats.filteredByPaths > 0) filterBreakdown.push(`${stats.filteredByPaths} by paths`);
		if (stats.filteredByMethods > 0) filterBreakdown.push(`${stats.filteredByMethods} by methods`);
		if (stats.filteredByOperationIds > 0) filterBreakdown.push(`${stats.filteredByOperationIds} by operationIds`);
		if (stats.filteredByDeprecated > 0) filterBreakdown.push(`${stats.filteredByDeprecated} by deprecated flag`);

		if (filterBreakdown.length > 0) {
			console.warn(`   Filtered: ${filterBreakdown.join(", ")}`);
		}
	}
}

/**
 * Format filter statistics for display in generated output
 * Returns a formatted string suitable for inclusion in comments
 *
 * @param stats - Filter statistics object
 * @returns Formatted statistics string
 */
export function formatFilterStatistics(stats: FilterStatistics): string {
	if (stats.totalOperations === 0) {
		return "";
	}

	const lines: string[] = [];
	lines.push("Operation Filtering:");
	lines.push(`  Total operations: ${stats.totalOperations}`);
	lines.push(`  Included operations: ${stats.includedOperations}`);

	const filteredCount =
		stats.filteredByTags +
		stats.filteredByPaths +
		stats.filteredByMethods +
		stats.filteredByOperationIds +
		stats.filteredByDeprecated;

	if (filteredCount > 0) {
		lines.push(`  Filtered operations: ${filteredCount}`);
		if (stats.filteredByTags > 0) lines.push(`    - By tags: ${stats.filteredByTags}`);
		if (stats.filteredByPaths > 0) lines.push(`    - By paths: ${stats.filteredByPaths}`);
		if (stats.filteredByMethods > 0) lines.push(`    - By methods: ${stats.filteredByMethods}`);
		if (stats.filteredByOperationIds > 0) lines.push(`    - By operationIds: ${stats.filteredByOperationIds}`);
		if (stats.filteredByDeprecated > 0) lines.push(`    - By deprecated: ${stats.filteredByDeprecated}`);
	}

	return lines.join("\n");
}
