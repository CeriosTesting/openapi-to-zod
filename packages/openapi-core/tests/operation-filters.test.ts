import { describe, expect, it } from "vitest";

import type { OperationFilters } from "../src/types";
import { createFilterStatistics, formatFilterStatistics, shouldIncludeOperation } from "../src/utils/operation-filters";

describe("operation-filters", () => {
	describe("shouldIncludeOperation", () => {
		it("should include all operations when no filters specified", () => {
			const operation = { operationId: "getUsers", tags: ["users"] };
			expect(shouldIncludeOperation(operation, "/users", "get")).toBe(true);
		});

		it("should include all operations when filters is undefined", () => {
			const operation = { operationId: "getUsers", tags: ["users"] };
			expect(shouldIncludeOperation(operation, "/users", "get", undefined)).toBe(true);
		});

		describe("includeTags", () => {
			it("should include operations with matching tags", () => {
				const operation = { tags: ["users"] };
				const filters: OperationFilters = { includeTags: ["users"] };
				expect(shouldIncludeOperation(operation, "/users", "get", filters)).toBe(true);
			});

			it("should exclude operations without matching tags", () => {
				const operation = { tags: ["posts"] };
				const filters: OperationFilters = { includeTags: ["users"] };
				expect(shouldIncludeOperation(operation, "/users", "get", filters)).toBe(false);
			});

			it("should include if any tag matches", () => {
				const operation = { tags: ["users", "admin"] };
				const filters: OperationFilters = { includeTags: ["admin"] };
				expect(shouldIncludeOperation(operation, "/users", "get", filters)).toBe(true);
			});
		});

		describe("excludeTags", () => {
			it("should exclude operations with matching tags", () => {
				const operation = { tags: ["internal"] };
				const filters: OperationFilters = { excludeTags: ["internal"] };
				expect(shouldIncludeOperation(operation, "/metrics", "get", filters)).toBe(false);
			});

			it("should include operations without excluded tags", () => {
				const operation = { tags: ["users"] };
				const filters: OperationFilters = { excludeTags: ["internal"] };
				expect(shouldIncludeOperation(operation, "/users", "get", filters)).toBe(true);
			});
		});

		describe("includePaths", () => {
			it("should include operations with matching paths", () => {
				const operation = {};
				const filters: OperationFilters = { includePaths: ["/users/**"] };
				expect(shouldIncludeOperation(operation, "/users/123", "get", filters)).toBe(true);
			});

			it("should exclude operations with non-matching paths", () => {
				const operation = {};
				const filters: OperationFilters = { includePaths: ["/users/**"] };
				expect(shouldIncludeOperation(operation, "/posts/123", "get", filters)).toBe(false);
			});
		});

		describe("excludePaths", () => {
			it("should exclude operations with matching paths", () => {
				const operation = {};
				const filters: OperationFilters = { excludePaths: ["/internal/**"] };
				expect(shouldIncludeOperation(operation, "/internal/metrics", "get", filters)).toBe(false);
			});

			it("should include operations with non-matching paths", () => {
				const operation = {};
				const filters: OperationFilters = { excludePaths: ["/internal/**"] };
				expect(shouldIncludeOperation(operation, "/users", "get", filters)).toBe(true);
			});
		});

		describe("includeMethods", () => {
			it("should include operations with matching methods", () => {
				const operation = {};
				const filters: OperationFilters = { includeMethods: ["get", "post"] };
				expect(shouldIncludeOperation(operation, "/users", "get", filters)).toBe(true);
				expect(shouldIncludeOperation(operation, "/users", "POST", filters)).toBe(true);
			});

			it("should exclude operations with non-matching methods", () => {
				const operation = {};
				const filters: OperationFilters = { includeMethods: ["get"] };
				expect(shouldIncludeOperation(operation, "/users", "post", filters)).toBe(false);
			});
		});

		describe("excludeMethods", () => {
			it("should exclude operations with matching methods", () => {
				const operation = {};
				const filters: OperationFilters = { excludeMethods: ["delete"] };
				expect(shouldIncludeOperation(operation, "/users/123", "delete", filters)).toBe(false);
			});

			it("should include operations with non-matching methods", () => {
				const operation = {};
				const filters: OperationFilters = { excludeMethods: ["delete"] };
				expect(shouldIncludeOperation(operation, "/users", "get", filters)).toBe(true);
			});
		});

		describe("includeOperationIds", () => {
			it("should include operations with matching operationIds", () => {
				const operation = { operationId: "getUsers" };
				const filters: OperationFilters = { includeOperationIds: ["get*"] };
				expect(shouldIncludeOperation(operation, "/users", "get", filters)).toBe(true);
			});

			it("should exclude operations with non-matching operationIds", () => {
				const operation = { operationId: "deleteUser" };
				const filters: OperationFilters = { includeOperationIds: ["get*"] };
				expect(shouldIncludeOperation(operation, "/users/123", "delete", filters)).toBe(false);
			});
		});

		describe("excludeOperationIds", () => {
			it("should exclude operations with matching operationIds", () => {
				const operation = { operationId: "deleteUser" };
				const filters: OperationFilters = { excludeOperationIds: ["delete*"] };
				expect(shouldIncludeOperation(operation, "/users/123", "delete", filters)).toBe(false);
			});
		});

		describe("excludeDeprecated", () => {
			it("should exclude deprecated operations when excludeDeprecated is true", () => {
				const operation = { deprecated: true };
				const filters: OperationFilters = { excludeDeprecated: true };
				expect(shouldIncludeOperation(operation, "/old-api", "get", filters)).toBe(false);
			});

			it("should include deprecated operations when excludeDeprecated is false", () => {
				const operation = { deprecated: true };
				const filters: OperationFilters = { excludeDeprecated: false };
				expect(shouldIncludeOperation(operation, "/old-api", "get", filters)).toBe(true);
			});

			it("should include non-deprecated operations", () => {
				const operation = { deprecated: false };
				const filters: OperationFilters = { excludeDeprecated: true };
				expect(shouldIncludeOperation(operation, "/api", "get", filters)).toBe(true);
			});
		});

		describe("statistics tracking", () => {
			it("should update statistics when provided", () => {
				const stats = createFilterStatistics();
				const operation = { tags: ["internal"] };
				const filters: OperationFilters = { excludeTags: ["internal"] };

				shouldIncludeOperation(operation, "/internal", "get", filters, stats);
				expect(stats.filteredByTags).toBe(1);
			});
		});
	});

	describe("createFilterStatistics", () => {
		it("should create statistics with all zeros", () => {
			const stats = createFilterStatistics();
			expect(stats.totalOperations).toBe(0);
			expect(stats.includedOperations).toBe(0);
			expect(stats.filteredByTags).toBe(0);
			expect(stats.filteredByPaths).toBe(0);
			expect(stats.filteredByMethods).toBe(0);
			expect(stats.filteredByOperationIds).toBe(0);
			expect(stats.filteredByDeprecated).toBe(0);
		});
	});

	describe("formatFilterStatistics", () => {
		it("should return empty string when no operations", () => {
			const stats = createFilterStatistics();
			expect(formatFilterStatistics(stats)).toBe("");
		});

		it("should format statistics with filtering info", () => {
			const stats = createFilterStatistics();
			stats.totalOperations = 10;
			stats.includedOperations = 7;
			stats.filteredByTags = 2;
			stats.filteredByPaths = 1;

			const formatted = formatFilterStatistics(stats);
			expect(formatted).toContain("Total operations: 10");
			expect(formatted).toContain("Included operations: 7");
			expect(formatted).toContain("By tags: 2");
			expect(formatted).toContain("By paths: 1");
		});
	});
});
