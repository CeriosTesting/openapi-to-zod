import { describe, expect, it } from "vitest";

import {
	extractPathParams,
	generateHttpMethodName,
	pathToPascalCase,
	sanitizeOperationId,
	sanitizeParamName,
} from "../src/utils/method-naming";

describe("method-naming", () => {
	describe("pathToPascalCase", () => {
		it("should handle simple paths", () => {
			expect(pathToPascalCase("/users")).toBe("Users");
			expect(pathToPascalCase("/users/profile")).toBe("UsersProfile");
		});

		it("should handle root path", () => {
			expect(pathToPascalCase("/")).toBe("Root");
		});

		it("should handle single path parameter", () => {
			expect(pathToPascalCase("/users/{userId}")).toBe("UsersByUserId");
			expect(pathToPascalCase("/users/{id}/posts")).toBe("UsersByIdPosts");
		});

		it("should handle multiple path parameters", () => {
			expect(pathToPascalCase("/users/{userId}/posts/{postId}")).toBe("UsersByUserIdPostsByPostId");
		});

		it("should handle @ symbol in path", () => {
			expect(pathToPascalCase("/connectors/@data")).toBe("ConnectorsAtData");
			expect(pathToPascalCase("/connectors/@key/value")).toBe("ConnectorsAtKeyValue");
		});

		it("should handle @ with path parameter", () => {
			expect(pathToPascalCase("/connectors/@Key/{key}")).toBe("ConnectorsAtKeyByKey");
		});

		it("should handle comma-separated path parts", () => {
			expect(pathToPascalCase("/connectors/@Cu,@Sn")).toBe("ConnectorsAtCuAtSn");
		});

		it("should handle multiple parameters in single segment with comma", () => {
			// AFAS-style paths: /{param1},{param2}
			expect(pathToPascalCase("/connectors/{Cu},{Sn}")).toBe("ConnectorsByCuSn");
		});

		it("should handle complex AFAS-style paths", () => {
			// Full AFAS-style composite key path
			expect(pathToPascalCase("/connectors/KnCurrencyRates/@Cu,@Sn/{Cu},{Sn}")).toBe(
				"ConnectorsKnCurrencyRatesAtCuAtSnByCuSn"
			);
		});

		it("should handle triple parameters", () => {
			expect(pathToPascalCase("/connectors/@A,@B,@C/{a},{b},{c}")).toBe("ConnectorsAtAAtBAtCByABC");
		});
	});

	describe("generateHttpMethodName", () => {
		it("should generate correct method names for simple paths", () => {
			expect(generateHttpMethodName("GET", "/users")).toBe("getUsers");
			expect(generateHttpMethodName("POST", "/users")).toBe("postUsers");
			expect(generateHttpMethodName("PUT", "/users/{id}")).toBe("putUsersById");
			expect(generateHttpMethodName("DELETE", "/users/{id}")).toBe("deleteUsersById");
		});

		it("should generate valid method names for paths with @ symbol", () => {
			expect(generateHttpMethodName("GET", "/connectors/@data")).toBe("getConnectorsAtData");
		});

		it("should generate valid method names for AFAS-style paths", () => {
			const result = generateHttpMethodName("DELETE", "/connectors/KnCurrencyRates/@Cu,@Sn/{Cu},{Sn}");
			expect(result).toBe("deleteConnectorsKnCurrencyRatesAtCuAtSnByCuSn");
			// Ensure no invalid characters
			expect(result).not.toMatch(/[,{}@]/);
		});
	});

	describe("extractPathParams", () => {
		it("should extract single parameter", () => {
			expect(extractPathParams("/users/{userId}")).toEqual(["userId"]);
		});

		it("should extract multiple parameters", () => {
			expect(extractPathParams("/users/{userId}/posts/{postId}")).toEqual(["userId", "postId"]);
		});

		it("should extract parameters from composite segments", () => {
			expect(extractPathParams("/connectors/{Cu},{Sn}")).toEqual(["Cu", "Sn"]);
		});

		it("should return empty array for no parameters", () => {
			expect(extractPathParams("/users/profile")).toEqual([]);
		});
	});

	describe("sanitizeParamName", () => {
		it("should handle kebab-case", () => {
			expect(sanitizeParamName("user-id")).toBe("userId");
		});

		it("should handle snake_case", () => {
			expect(sanitizeParamName("user_id")).toBe("userId");
		});

		it("should prefix with _ for numeric start", () => {
			expect(sanitizeParamName("123abc")).toBe("_123abc");
		});

		it("should remove special characters", () => {
			// Special characters like @ are removed (not treated as word separators)
			expect(sanitizeParamName("user@domain")).toBe("userdomain");
		});
	});

	describe("sanitizeOperationId", () => {
		it("should convert to camelCase", () => {
			expect(sanitizeOperationId("GetUsers")).toBe("getUsers");
			expect(sanitizeOperationId("get-users")).toBe("getUsers");
			expect(sanitizeOperationId("get_users")).toBe("getUsers");
		});

		it("should already valid identifiers", () => {
			expect(sanitizeOperationId("getUsers")).toBe("getUsers");
		});

		it("should handle special characters", () => {
			expect(sanitizeOperationId("get@users")).toBe("getUsers");
		});

		it("should prefix with _ for numeric start", () => {
			expect(sanitizeOperationId("123getUsers")).toBe("_123getusers");
		});
	});
});
