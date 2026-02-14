import { describe, expect, it } from "vitest";
import {
	generateHeaderParamsTypeName,
	generateInlineRequestTypeName,
	generateInlineResponseTypeName,
	generateMethodNameFromPath,
	generatePathParamsTypeName,
	generateQueryParamsTypeName,
	getOperationName,
	resolveRefName,
	toCamelCase,
	toPascalCase,
} from "../src/utils/name-utils";

describe("name-utils", () => {
	describe("toCamelCase", () => {
		it("should convert simple string to camelCase", () => {
			expect(toCamelCase("User")).toBe("user");
			expect(toCamelCase("user")).toBe("user");
		});

		it("should handle dotted names", () => {
			expect(toCamelCase("Company.Models.User")).toBe("companyModelsUser");
		});

		it("should handle hyphenated names", () => {
			expect(toCamelCase("user-profile")).toBe("userProfile");
		});

		it("should handle underscored names", () => {
			expect(toCamelCase("user_profile")).toBe("userProfile");
		});

		it("should handle spaces", () => {
			expect(toCamelCase("user profile")).toBe("userProfile");
		});

		it("should handle mixed separators", () => {
			expect(toCamelCase("Company.User-Profile_Data")).toBe("companyUserProfileData");
		});

		it("should add prefix", () => {
			expect(toCamelCase("User", { prefix: "api" })).toBe("apiUser");
		});

		it("should add suffix", () => {
			expect(toCamelCase("User", { suffix: "Schema" })).toBe("userSchema");
		});

		it("should add both prefix and suffix", () => {
			expect(toCamelCase("User", { prefix: "api", suffix: "Schema" })).toBe("apiUserSchema");
		});

		it("should handle special characters", () => {
			// Special characters like @ are replaced with _ and then split as word separator
			expect(toCamelCase("User@Domain")).toBe("userDomain");
		});
	});

	describe("toPascalCase", () => {
		it("should convert simple string to PascalCase", () => {
			expect(toPascalCase("user")).toBe("User");
			expect(toPascalCase("User")).toBe("User");
		});

		it("should handle dotted names", () => {
			expect(toPascalCase("Company.Models.User")).toBe("CompanyModelsUser");
		});

		it("should handle hyphenated names", () => {
			expect(toPascalCase("user-profile")).toBe("UserProfile");
		});

		it("should handle underscored names", () => {
			expect(toPascalCase("user_profile")).toBe("UserProfile");
		});

		it("should handle numbers", () => {
			expect(toPascalCase(123)).toBe("N123");
		});

		it("should prefix with N if starts with number", () => {
			expect(toPascalCase("123abc")).toBe("N123abc");
		});

		it("should return Value for empty-like strings", () => {
			expect(toPascalCase("")).toBe("Value");
			expect(toPascalCase("___")).toBe("Value");
		});

		it("should handle already valid identifiers", () => {
			expect(toPascalCase("UserProfile")).toBe("UserProfile");
			expect(toPascalCase("userProfile")).toBe("UserProfile");
		});
	});

	describe("resolveRefName", () => {
		it("should extract schema name from $ref", () => {
			expect(resolveRefName("#/components/schemas/User")).toBe("User");
		});

		it("should handle nested paths", () => {
			expect(resolveRefName("#/components/schemas/Company.User")).toBe("Company.User");
		});

		it("should handle simple paths", () => {
			expect(resolveRefName("User")).toBe("User");
		});
	});

	describe("generateMethodNameFromPath", () => {
		it("should generate name from simple path", () => {
			expect(generateMethodNameFromPath("get", "/users")).toBe("GetUsers");
			expect(generateMethodNameFromPath("post", "/users")).toBe("PostUsers");
		});

		it("should handle path parameters", () => {
			expect(generateMethodNameFromPath("get", "/users/{userId}")).toBe("GetUsersByUserId");
			expect(generateMethodNameFromPath("delete", "/users/{userId}/posts/{postId}")).toBe(
				"DeleteUsersByUserIdPostsByPostId"
			);
		});

		it("should handle versioned paths", () => {
			expect(generateMethodNameFromPath("get", "/api/v1/users")).toBe("GetApiV1Users");
			expect(generateMethodNameFromPath("get", "/api/v0.1/users")).toBe("GetApiV01Users");
		});

		it("should handle kebab-case segments", () => {
			expect(generateMethodNameFromPath("get", "/user-profiles")).toBe("GetUserProfiles");
		});

		it("should handle snake_case segments", () => {
			expect(generateMethodNameFromPath("get", "/user_profiles")).toBe("GetUserProfiles");
		});

		it("should handle mixed HTTP methods", () => {
			expect(generateMethodNameFromPath("GET", "/users")).toBe("GetUsers");
			expect(generateMethodNameFromPath("Post", "/users")).toBe("PostUsers");
			expect(generateMethodNameFromPath("DELETE", "/users")).toBe("DeleteUsers");
		});

		it("should handle empty path", () => {
			expect(generateMethodNameFromPath("get", "/")).toBe("Get");
		});

		it("should handle complex nested paths", () => {
			expect(generateMethodNameFromPath("put", "/organizations/{orgId}/teams/{teamId}/members")).toBe(
				"PutOrganizationsByOrgIdTeamsByTeamIdMembers"
			);
		});

		it('should replace "@" with "At" in path segments', () => {
			expect(generateMethodNameFromPath("get", "/feeds/@channel/{channelId}")).toBe("GetFeedsAtChannelByChannelId");
		});
	});

	describe("getOperationName", () => {
		it("should use operationId when available", () => {
			expect(getOperationName("getUsers", "get", "/users")).toBe("GetUsers");
			expect(getOperationName("listAllUsers", "get", "/users")).toBe("ListAllUsers");
		});

		it("should handle kebab-case operationId", () => {
			expect(getOperationName("get-users", "get", "/users")).toBe("GetUsers");
			expect(getOperationName("list-all-users", "get", "/users")).toBe("ListAllUsers");
		});

		it("should fall back to path when operationId is undefined", () => {
			expect(getOperationName(undefined, "get", "/users")).toBe("GetUsers");
			expect(getOperationName(undefined, "post", "/users/{userId}")).toBe("PostUsersByUserId");
		});
	});

	describe("generateInlineResponseTypeName", () => {
		it("should generate response type name without status for single response", () => {
			expect(generateInlineResponseTypeName("GetUsers", "200", false)).toBe("GetUsersResponse");
		});

		it("should include status code for multiple responses", () => {
			expect(generateInlineResponseTypeName("GetUsers", "200", true)).toBe("GetUsers200Response");
			expect(generateInlineResponseTypeName("GetUsers", "404", true)).toBe("GetUsers404Response");
		});

		it("should handle various operation names", () => {
			expect(generateInlineResponseTypeName("PostUsersByUserId", "201", false)).toBe("PostUsersByUserIdResponse");
		});
	});

	describe("generateInlineRequestTypeName", () => {
		it("should generate request type name without suffix for single content type", () => {
			expect(generateInlineRequestTypeName("PostUsers", "application/json", false)).toBe("PostUsersRequest");
		});

		it("should include content type suffix for multiple content types", () => {
			expect(generateInlineRequestTypeName("PostUsers", "application/json", true)).toBe("PostUsersJsonRequest");
			expect(generateInlineRequestTypeName("PostUsers", "application/xml", true)).toBe("PostUsersXmlRequest");
			expect(generateInlineRequestTypeName("PostUsers", "multipart/form-data", true)).toBe("PostUsersFormDataRequest");
			expect(generateInlineRequestTypeName("PostUsers", "application/x-www-form-urlencoded", true)).toBe(
				"PostUsersFormRequest"
			);
			expect(generateInlineRequestTypeName("PostUsers", "text/plain", true)).toBe("PostUsersTextRequest");
			expect(generateInlineRequestTypeName("PostUsers", "application/octet-stream", true)).toBe(
				"PostUsersBinaryRequest"
			);
		});

		it("should handle unknown content types with no suffix", () => {
			expect(generateInlineRequestTypeName("PostUsers", "application/custom", true)).toBe("PostUsersRequest");
		});
	});

	describe("generateQueryParamsTypeName", () => {
		it("should generate query params type name", () => {
			expect(generateQueryParamsTypeName("GetUsers")).toBe("GetUsersQueryParams");
			expect(generateQueryParamsTypeName("ListAllItems")).toBe("ListAllItemsQueryParams");
		});
	});

	describe("generateHeaderParamsTypeName", () => {
		it("should generate header params type name", () => {
			expect(generateHeaderParamsTypeName("GetUsers")).toBe("GetUsersHeaderParams");
			expect(generateHeaderParamsTypeName("PostData")).toBe("PostDataHeaderParams");
		});
	});

	describe("generatePathParamsTypeName", () => {
		it("should generate path params type name", () => {
			expect(generatePathParamsTypeName("GetUserById")).toBe("GetUserByIdPathParams");
			expect(generatePathParamsTypeName("DeletePost")).toBe("DeletePostPathParams");
		});
	});
});
