import type { OperationFilters } from "../types";

// Re-export base operation filtering utilities from public API
export {
	createFilterStatistics,
	type FilterStatistics,
	formatFilterStatistics,
	shouldIncludeOperation,
	validateFilters,
} from "@cerios/openapi-to-zod";

/**
 * Extended filter statistics for Playwright (includes status code filtering)
 */
export interface PlaywrightFilterStatistics {
	totalOperations: number;
	includedOperations: number;
	filteredByTags: number;
	filteredByPaths: number;
	filteredByMethods: number;
	filteredByOperationIds: number;
	filteredByDeprecated: number;
	filteredByStatusCodes: number;
}

/**
 * Create a new Playwright filter statistics object with all counters initialized to zero
 */
export function createPlaywrightFilterStatistics(): PlaywrightFilterStatistics {
	return {
		totalOperations: 0,
		includedOperations: 0,
		filteredByTags: 0,
		filteredByPaths: 0,
		filteredByMethods: 0,
		filteredByOperationIds: 0,
		filteredByDeprecated: 0,
		filteredByStatusCodes: 0,
	};
}

/**
 * Check if a status code should be included based on filter criteria
 *
 * Supports:
 * - Exact codes: "200", "404", "500"
 * - Range patterns: "2xx", "4xx", "5xx" (matches all codes in that range)
 *
 * Filter logic:
 * 1. If no filters specified, include all status codes
 * 2. Empty arrays are treated as "no constraint"
 * 3. Include filters are applied first (allowlist)
 * 4. Exclude filters are applied second (blocklist)
 * 5. Exclude rules always win over include rules
 *
 * @param statusCode - The status code as a string (e.g., "200", "404")
 * @param filters - Optional filter configuration
 * @returns true if the status code should be included, false otherwise
 */
export function shouldIncludeStatusCode(
	statusCode: string,
	filters?: Pick<OperationFilters, "includeStatusCodes" | "excludeStatusCodes">
): boolean {
	// If no filters specified, include all status codes
	if (!filters) {
		return true;
	}

	/**
	 * Check if a status code matches a pattern
	 * Supports exact match ("200") and range patterns ("2xx")
	 */
	const matchesPattern = (code: string, pattern: string): boolean => {
		// Exact match
		if (code === pattern) {
			return true;
		}

		// Range pattern (e.g., "2xx", "4xx", "5xx")
		const rangeMatch = /^(\d)xx$/i.exec(pattern);
		if (rangeMatch) {
			const rangePrefix = rangeMatch[1];
			return code.startsWith(rangePrefix);
		}

		return false;
	};

	/**
	 * Check if status code matches any of the patterns
	 */
	const matchesAny = (patterns: string[] | undefined): boolean => {
		if (!patterns || patterns.length === 0) {
			return false; // No constraint
		}
		return patterns.some(pattern => matchesPattern(statusCode, pattern));
	};

	// Apply include filters first (allowlist)
	if (filters.includeStatusCodes && filters.includeStatusCodes.length > 0) {
		if (!matchesAny(filters.includeStatusCodes)) {
			return false;
		}
	}

	// Apply exclude filters second (blocklist)
	if (filters.excludeStatusCodes && filters.excludeStatusCodes.length > 0) {
		if (matchesAny(filters.excludeStatusCodes)) {
			return false;
		}
	}

	// Status code passed all filters
	return true;
}

/**
 * Validate Playwright filter statistics and emit warnings for filters that matched nothing
 *
 * @param stats - Playwright filter statistics object
 * @param filters - The filter configuration to validate
 */
export function validatePlaywrightFilters(stats: PlaywrightFilterStatistics, filters?: OperationFilters): void {
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
		if (stats.filteredByStatusCodes > 0) filterBreakdown.push(`${stats.filteredByStatusCodes} by status codes`);

		if (filterBreakdown.length > 0) {
			console.warn(`   Filtered: ${filterBreakdown.join(", ")}`);
		}
	}
}

/**
 * Format Playwright filter statistics for display in generated output
 * Returns a formatted string suitable for inclusion in comments
 *
 * @param stats - Playwright filter statistics object
 * @returns Formatted statistics string
 */
export function formatPlaywrightFilterStatistics(stats: PlaywrightFilterStatistics): string {
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
		stats.filteredByDeprecated +
		stats.filteredByStatusCodes;

	if (filteredCount > 0) {
		lines.push(`  Filtered operations: ${filteredCount}`);
		if (stats.filteredByTags > 0) lines.push(`    - By tags: ${stats.filteredByTags}`);
		if (stats.filteredByPaths > 0) lines.push(`    - By paths: ${stats.filteredByPaths}`);
		if (stats.filteredByMethods > 0) lines.push(`    - By methods: ${stats.filteredByMethods}`);
		if (stats.filteredByOperationIds > 0) lines.push(`    - By operationIds: ${stats.filteredByOperationIds}`);
		if (stats.filteredByDeprecated > 0) lines.push(`    - By deprecated: ${stats.filteredByDeprecated}`);
		if (stats.filteredByStatusCodes > 0) lines.push(`    - By status codes: ${stats.filteredByStatusCodes}`);
	}

	return lines.join("\n");
}
