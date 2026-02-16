import { describe, expect, it } from "vitest";

import { stripPathPrefix, stripPrefix } from "../src/utils/pattern-utils";

describe("pattern-utils", () => {
	describe("stripPrefix", () => {
		it("should return input unchanged when pattern is undefined", () => {
			expect(stripPrefix("test", undefined)).toBe("test");
		});

		it("should strip literal prefix", () => {
			expect(stripPrefix("/api/v1/users", "/api/v1")).toBe("/users");
		});

		it("should strip dotted prefix", () => {
			expect(stripPrefix("Company.Models.User", "Company.Models.")).toBe("User");
		});

		it("should return original when prefix doesn't match", () => {
			expect(stripPrefix("/api/v2/users", "/api/v1")).toBe("/api/v2/users");
		});

		it("should handle glob pattern with *", () => {
			// /api/v* matches /api/v1/ (with the trailing /), so "users" remains
			expect(stripPrefix("/api/v1/users", "/api/v*")).toBe("users");
			expect(stripPrefix("/api/v2/users", "/api/v*")).toBe("users");
		});

		it("should handle glob pattern with ensureLeadingChar", () => {
			// With ensureLeadingChar, the result should start with that character
			expect(stripPrefix("/api/v1/users", "/api/v*", "/")).toBe("/users");
			expect(stripPrefix("/api/v2/users", "/api/v*", "/")).toBe("/users");
		});

		it("should ensure leading character when specified", () => {
			expect(stripPrefix("/api/v1/users", "/api/v1", "/")).toBe("/users");
			expect(stripPrefix("/api/v1users", "/api/v1", "/")).toBe("/users");
		});

		it("should return leading char when entire string is stripped", () => {
			expect(stripPrefix("/api/v1", "/api/v1", "/")).toBe("/");
		});

		it("should treat malformed glob patterns as literals", () => {
			// Minimatch doesn't throw on "[invalid", it silently accepts it
			// The pattern doesn't match "test", so original is returned
			expect(stripPrefix("test", "[invalid")).toBe("test");
			// But if the literal happens to match, it strips it
			expect(stripPrefix("[invalidprefix", "[invalid")).toBe("prefix");
		});
	});

	describe("stripPathPrefix", () => {
		it("should return path unchanged when pattern is undefined", () => {
			expect(stripPathPrefix("/api/v1/users", undefined)).toBe("/api/v1/users");
		});

		it("should strip literal path prefix", () => {
			expect(stripPathPrefix("/api/v1/users", "/api/v1")).toBe("/users");
		});

		it("should normalize pattern without leading slash", () => {
			expect(stripPathPrefix("/api/v1/users", "api/v1")).toBe("/users");
		});

		it("should handle trailing slash in pattern", () => {
			expect(stripPathPrefix("/api/v1/users", "/api/v1/")).toBe("/users");
		});

		it("should handle glob patterns", () => {
			expect(stripPathPrefix("/api/v1/users", "/api/v*")).toBe("/users");
			expect(stripPathPrefix("/api/v2/posts", "/api/v*")).toBe("/posts");
		});

		it("should ensure result starts with /", () => {
			expect(stripPathPrefix("/api/v1/users", "/api/v1")).toBe("/users");
			expect(stripPathPrefix("/api", "/api")).toBe("/");
		});
	});
});
