import { describe, expect, it } from "vitest";
import { stripPathPrefix, stripPrefix } from "../src/utils/pattern-utils";

describe("stripPrefix", () => {
	describe("literal string matching", () => {
		it("should strip exact string prefix", () => {
			expect(stripPrefix("Company.Models.User", "Company.Models.")).toBe("User");
			expect(stripPrefix("api_v1_UserSchema", "api_v1_")).toBe("UserSchema");
			expect(stripPrefix("Namespace.App.User", "Namespace.App.")).toBe("User");
		});

		it("should return original string when prefix doesn't match", () => {
			expect(stripPrefix("User", "Company.")).toBe("User");
			expect(stripPrefix("api_v2_User", "api_v1_")).toBe("api_v2_User");
		});

		it("should handle empty prefix", () => {
			expect(stripPrefix("User", "")).toBe("User");
			expect(stripPrefix("User", undefined)).toBe("User");
		});

		it("should handle case sensitivity", () => {
			expect(stripPrefix("Company.Models.User", "company.models.")).toBe("Company.Models.User");
			expect(stripPrefix("API_User", "api_")).toBe("API_User");
		});

		it("should not strip partial matches", () => {
			expect(stripPrefix("CompanyUser", "Company")).toBe("User");
			expect(stripPrefix("Company.User", "Company.Models.")).toBe("Company.User");
		});
	});

	describe("glob pattern matching", () => {
		it("should detect and use glob with wildcard", () => {
			expect(stripPrefix("api_v1_User", "api_v*_")).toBe("User");
			expect(stripPrefix("api_v2_Post", "api_v*_")).toBe("Post");
			expect(stripPrefix("api_v10_Comment", "api_v*_")).toBe("Comment");
		});

		it("should detect and use glob with character classes", () => {
			expect(stripPrefix("Company.User", "*[yY].")).toBe("User");
			expect(stripPrefix("App.Comment", "A*.")).toBe("Comment");
		});

		it("should use glob with question mark for single character", () => {
			expect(stripPrefix("v1.User", "v?.")).toBe("User");
			expect(stripPrefix("a_User", "?_")).toBe("User");
		});

		it("should use glob with alternatives", () => {
			expect(stripPrefix("Company.Models.User", "*.{Models,Services}.")).toBe("User");
			expect(stripPrefix("App.Services.Post", "*.{Models,Services}.")).toBe("Post");
		});

		it("should return original string when glob doesn't match", () => {
			expect(stripPrefix("User", "api_v*_")).toBe("User");
			expect(stripPrefix("api_User", "api_v*_")).toBe("api_User");
		});

		it("should handle invalid glob gracefully", () => {
			// Invalid glob should warn and return original
			expect(stripPrefix("User", "[invalid")).toBe("User");
		});
	});

	describe("ensureLeadingChar parameter", () => {
		it("should ensure leading character after stripping", () => {
			expect(stripPrefix("api/users", "api", "/")).toBe("/users");
			expect(stripPrefix("api/v1/users", "api", "/")).toBe("/v1/users");
		});

		it("should add leading character if result doesn't have it", () => {
			expect(stripPrefix("prefix_value", "prefix_", "_")).toBe("_value");
			expect(stripPrefix("prefix-value", "prefix-", "-")).toBe("-value");
		});

		it("should return leading character for empty result", () => {
			expect(stripPrefix("api", "api", "/")).toBe("/");
			expect(stripPrefix("prefix_", "prefix_", "_")).toBe("_");
		});

		it("should not add leading character if already present", () => {
			expect(stripPrefix("api/_users", "api/", "/")).toBe("/_users");
			expect(stripPrefix("prefix__value", "prefix_", "_")).toBe("_value");
		});

		it("should work with glob patterns", () => {
			expect(stripPrefix("api_v1_users", "api_v*_", "_")).toBe("_users");
			expect(stripPrefix("Company.Models.User", "*.Models.", ".")).toBe(".User");
		});
	});
});

describe("stripPathPrefix", () => {
	describe("literal string matching", () => {
		it("should strip exact path prefix", () => {
			expect(stripPathPrefix("/api/v1/users", "/api/v1")).toBe("/users");
			expect(stripPathPrefix("/api/v2/posts", "/api/v2")).toBe("/posts");
		});

		it("should normalize path prefix (add leading slash)", () => {
			expect(stripPathPrefix("/api/v1/users", "api/v1")).toBe("/users");
			expect(stripPathPrefix("/api/v1/users", "api")).toBe("/v1/users");
		});

		it("should normalize path prefix (remove trailing slash)", () => {
			expect(stripPathPrefix("/api/v1/users", "/api/v1/")).toBe("/users");
			expect(stripPathPrefix("/api/users", "/api/")).toBe("/users");
		});

		it("should handle root path", () => {
			expect(stripPathPrefix("/api", "/api")).toBe("/");
			expect(stripPathPrefix("/", "/")).toBe("/");
		});

		it("should ensure result starts with slash", () => {
			expect(stripPathPrefix("/apiusers", "/api")).toBe("/users");
			expect(stripPathPrefix("/api/users", "/api")).toBe("/users");
		});

		it("should return original path when prefix doesn't match", () => {
			expect(stripPathPrefix("/users", "/api")).toBe("/users");
			expect(stripPathPrefix("/v2/users", "/api/v1")).toBe("/v2/users");
		});

		it("should handle empty or undefined prefix", () => {
			expect(stripPathPrefix("/api/users", "")).toBe("/api/users");
			expect(stripPathPrefix("/api/users", undefined)).toBe("/api/users");
		});
	});

	describe("glob pattern matching", () => {
		it("should detect and use glob with wildcard", () => {
			expect(stripPathPrefix("/api/v1/users", "/api/v*")).toBe("/users");
			expect(stripPathPrefix("/api/v2/posts", "/api/v*")).toBe("/posts");
			expect(stripPathPrefix("/api/v10/comments", "/api/v*")).toBe("/comments");
		});

		it("should use glob with version patterns", () => {
			expect(stripPathPrefix("/api/v1.0/users", "/api/v*.*")).toBe("/users");
			expect(stripPathPrefix("/api/v2.1/posts", "/api/v*.*")).toBe("/posts");
		});

		it("should use glob with character class", () => {
			expect(stripPathPrefix("/api/v1/users", "/api/v[0-9]")).toBe("/users");
			expect(stripPathPrefix("/api/v2/posts", "/api/v[0-9]")).toBe("/posts");
		});

		it("should ensure result starts with slash after glob match", () => {
			expect(stripPathPrefix("/api/v1/users", "/api/v*")).toBe("/users");
			expect(stripPathPrefix("/api/version1/users", "/api/version*")).toBe("/users");
		});

		it("should return original path when glob doesn't match", () => {
			expect(stripPathPrefix("/users", "/api/v*")).toBe("/users");
			expect(stripPathPrefix("/api/users", "/api/v*")).toBe("/api/users");
		});

		it("should handle root path with glob", () => {
			expect(stripPathPrefix("/api/v1", "/api/v*")).toBe("/");
		});
	});

	describe("edge cases", () => {
		it("should handle paths with special characters", () => {
			expect(stripPathPrefix("/api/v1.0/users", "/api/v1.0")).toBe("/users");
			expect(stripPathPrefix("/api-v1/users", "/api-v1")).toBe("/users");
			expect(stripPathPrefix("/api_v1/users", "/api_v1")).toBe("/users");
		});

		it("should handle deeply nested paths", () => {
			expect(stripPathPrefix("/api/v1/internal/admin/users", "/api/v1/internal")).toBe("/admin/users");
			expect(stripPathPrefix("/a/b/c/d/e/f", "/a/b/c")).toBe("/d/e/f");
		});

		it("should handle paths with query parameters (not stripped)", () => {
			expect(stripPathPrefix("/api/v1/users?page=1", "/api/v1")).toBe("/users?page=1");
		});

		it("should handle paths with fragments (not stripped)", () => {
			expect(stripPathPrefix("/api/v1/users#section", "/api/v1")).toBe("/users#section");
		});

		it("should be case sensitive", () => {
			expect(stripPathPrefix("/API/V1/users", "/api/v1")).toBe("/API/V1/users");
			expect(stripPathPrefix("/api/v1/users", "/API/V1")).toBe("/api/v1/users");
		});
	});
});
