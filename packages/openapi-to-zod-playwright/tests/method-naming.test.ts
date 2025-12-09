import { describe, expect, it } from "vitest";
import { extractPathParams, generateMethodName, sanitizeParamName } from "../src/utils/method-naming";

describe("Method Naming Utilities", () => {
	describe("generateMethodName", () => {
		it("should generate method names for simple paths", () => {
			expect(generateMethodName("get", "/users")).toBe("getUsers");
			expect(generateMethodName("post", "/users")).toBe("postUsers");
			expect(generateMethodName("delete", "/users")).toBe("deleteUsers");
		});

		it("should handle path parameters", () => {
			expect(generateMethodName("get", "/users/{userId}")).toBe("getUsersByUserId");
			expect(generateMethodName("get", "/users/{id}")).toBe("getUsersById");
		});

		it("should handle multiple path parameters", () => {
			expect(generateMethodName("get", "/users/{userId}/posts/{postId}")).toBe("getUsersByUserIdPostsByPostId");
		});

		it("should handle nested paths", () => {
			expect(generateMethodName("get", "/api/v1/users")).toBe("getApiV1Users");
			expect(generateMethodName("get", "/organizations/{orgId}/teams/{teamId}/members")).toBe(
				"getOrganizationsByOrgIdTeamsByTeamIdMembers"
			);
		});

		it("should handle kebab-case paths", () => {
			expect(generateMethodName("get", "/user-profiles")).toBe("getUserProfiles");
			expect(generateMethodName("post", "/user-settings")).toBe("postUserSettings");
		});

		it("should handle snake_case paths", () => {
			expect(generateMethodName("get", "/user_profiles")).toBe("getUserProfiles");
			expect(generateMethodName("post", "/user_settings")).toBe("postUserSettings");
		});

		it("should handle root path", () => {
			expect(generateMethodName("get", "/")).toBe("getRoot");
			expect(generateMethodName("post", "/")).toBe("postRoot");
		});
	});

	describe("extractPathParams", () => {
		it("should extract path parameters", () => {
			expect(extractPathParams("/users/{userId}")).toEqual(["userId"]);
			expect(extractPathParams("/users/{userId}/posts/{postId}")).toEqual(["userId", "postId"]);
		});

		it("should return empty array for paths without parameters", () => {
			expect(extractPathParams("/users")).toEqual([]);
			expect(extractPathParams("/api/v1/users")).toEqual([]);
		});

		it("should handle parameters with special characters", () => {
			expect(extractPathParams("/users/{user-id}")).toEqual(["user-id"]);
			expect(extractPathParams("/users/{user_id}")).toEqual(["user_id"]);
		});

		it("should handle multiple consecutive parameters", () => {
			expect(extractPathParams("/{orgId}/{teamId}/{userId}")).toEqual(["orgId", "teamId", "userId"]);
		});
	});

	describe("sanitizeParamName", () => {
		it("should return valid identifiers unchanged", () => {
			expect(sanitizeParamName("userId")).toBe("userId");
			expect(sanitizeParamName("postId")).toBe("postId");
		});

		it("should convert kebab-case to camelCase", () => {
			expect(sanitizeParamName("user-id")).toBe("userId");
			expect(sanitizeParamName("post-category-id")).toBe("postCategoryId");
		});

		it("should convert snake_case to camelCase", () => {
			expect(sanitizeParamName("user_id")).toBe("userId");
			expect(sanitizeParamName("post_category_id")).toBe("postCategoryId");
		});

		it("should prefix numbers with underscore", () => {
			expect(sanitizeParamName("123id")).toBe("_123id");
		});

		it("should remove special characters", () => {
			expect(sanitizeParamName("user@id")).toBe("userid");
			expect(sanitizeParamName("user$id")).toBe("userid");
		});

		it("should handle mixed cases", () => {
			expect(sanitizeParamName("user-id_name")).toBe("userIdName");
		});
	});
});
