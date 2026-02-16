import { describe, expect, it } from "vitest";

import {
	buildQueryString,
	cleanBaseUrl,
	mergeRequestParameters,
	serializeBody,
	stringifyHeaders,
} from "../src/runtime";

describe("Runtime Utilities", () => {
	describe("mergeRequestParameters", () => {
		it("should merge empty parameters", () => {
			const result = mergeRequestParameters({}, {});
			expect(result).toEqual({
				headers: {},
				tags: {},
			});
		});

		it("should preserve common parameters when request params are empty", () => {
			const common = {
				timeout: "30s",
				headers: { "X-Common": "value" },
				tags: { env: "test" },
			};
			const result = mergeRequestParameters({}, common);

			expect(result.timeout).toBe("30s");
			expect(result.headers).toEqual({ "X-Common": "value" });
			expect(result.tags).toEqual({ env: "test" });
		});

		it("should let request parameters override common parameters", () => {
			const common = {
				timeout: "30s",
				headers: { "X-Common": "value" },
			};
			const request = {
				timeout: "60s",
				headers: { "X-Request": "override" },
			};
			const result = mergeRequestParameters(request, common);

			expect(result.timeout).toBe("60s");
			expect(result.headers).toEqual({
				"X-Common": "value",
				"X-Request": "override",
			});
		});

		it("should merge headers from both sources", () => {
			const common = {
				headers: { Authorization: "Bearer token", "X-Common": "value" },
			};
			const request = {
				headers: { "X-Request-ID": "123" },
			};
			const result = mergeRequestParameters(request, common);

			expect(result.headers).toEqual({
				Authorization: "Bearer token",
				"X-Common": "value",
				"X-Request-ID": "123",
			});
		});

		it("should merge tags from both sources", () => {
			const common = {
				tags: { env: "test", version: "1.0" },
			};
			const request = {
				tags: { feature: "login" },
			};
			const result = mergeRequestParameters(request, common);

			expect(result.tags).toEqual({
				env: "test",
				version: "1.0",
				feature: "login",
			});
		});

		it("should handle undefined headers and tags gracefully", () => {
			const common = { timeout: "30s" };
			const request = { redirects: 5 };
			const result = mergeRequestParameters(request, common);

			expect(result.timeout).toBe("30s");
			expect(result.redirects).toBe(5);
			expect(result.headers).toEqual({});
			expect(result.tags).toEqual({});
		});
	});

	describe("stringifyHeaders", () => {
		it("should convert string values unchanged", () => {
			const result = stringifyHeaders({ "Content-Type": "application/json" });
			expect(result).toEqual({ "Content-Type": "application/json" });
		});

		it("should convert number values to strings", () => {
			const result = stringifyHeaders({ "X-Count": 42 });
			expect(result).toEqual({ "X-Count": "42" });
		});

		it("should convert boolean values to strings", () => {
			const result = stringifyHeaders({ "X-Enabled": true, "X-Disabled": false });
			expect(result).toEqual({ "X-Enabled": "true", "X-Disabled": "false" });
		});

		it("should handle mixed value types", () => {
			const result = stringifyHeaders({
				"Content-Type": "application/json",
				"X-Count": 42,
				"X-Enabled": true,
				"X-Version": 1.5,
			});
			expect(result).toEqual({
				"Content-Type": "application/json",
				"X-Count": "42",
				"X-Enabled": "true",
				"X-Version": "1.5",
			});
		});

		it("should handle null and undefined values", () => {
			const result = stringifyHeaders({
				"X-Null": null,
				"X-Undefined": undefined,
			});
			expect(result).toEqual({
				"X-Null": "null",
				"X-Undefined": "undefined",
			});
		});

		it("should handle empty object", () => {
			const result = stringifyHeaders({});
			expect(result).toEqual({});
		});

		it("should handle undefined input", () => {
			const result = stringifyHeaders(undefined as any);
			expect(result).toEqual({});
		});
	});

	describe("buildQueryString", () => {
		it("should return empty string for undefined params", () => {
			const result = buildQueryString(undefined);
			expect(result).toBe("");
		});

		it("should return empty string for empty object", () => {
			const result = buildQueryString({});
			expect(result).toBe("");
		});

		it("should build query string from simple params", () => {
			const result = buildQueryString({ foo: "bar", count: 10 });
			expect(result).toBe("?foo=bar&count=10");
		});

		it("should handle string values", () => {
			const result = buildQueryString({ name: "John Doe", city: "New York" });
			expect(result).toBe("?name=John+Doe&city=New+York");
		});

		it("should handle number values", () => {
			const result = buildQueryString({ page: 1, limit: 20 });
			expect(result).toBe("?page=1&limit=20");
		});

		it("should handle boolean values", () => {
			const result = buildQueryString({ active: true, deleted: false });
			expect(result).toBe("?active=true&deleted=false");
		});

		it("should handle array values with multiple entries", () => {
			const result = buildQueryString({ tags: ["a", "b", "c"] });
			expect(result).toBe("?tags=a&tags=b&tags=c");
		});

		it("should handle mixed array types", () => {
			const result = buildQueryString({ ids: [1, 2, 3] });
			expect(result).toBe("?ids=1&ids=2&ids=3");
		});

		it("should skip null values", () => {
			const result = buildQueryString({ foo: "bar", empty: null });
			expect(result).toBe("?foo=bar");
		});

		it("should skip undefined values", () => {
			const result = buildQueryString({ foo: "bar", empty: undefined });
			expect(result).toBe("?foo=bar");
		});

		it("should handle special characters", () => {
			const result = buildQueryString({ query: "hello world", filter: "a=b&c=d" });
			// URLSearchParams encodes special characters
			expect(result).toContain("query=hello+world");
			expect(result).toContain("filter=a%3Db%26c%3Dd");
		});

		it("should handle empty arrays", () => {
			const result = buildQueryString({ tags: [] });
			expect(result).toBe("");
		});

		it("should handle mixed params with arrays", () => {
			const result = buildQueryString({
				page: 1,
				tags: ["a", "b"],
				active: true,
			});
			expect(result).toContain("page=1");
			expect(result).toContain("tags=a");
			expect(result).toContain("tags=b");
			expect(result).toContain("active=true");
		});
	});

	describe("cleanBaseUrl", () => {
		it("should remove single trailing slash", () => {
			const result = cleanBaseUrl("https://api.example.com/");
			expect(result).toBe("https://api.example.com");
		});

		it("should remove multiple trailing slashes", () => {
			const result = cleanBaseUrl("https://api.example.com///");
			expect(result).toBe("https://api.example.com");
		});

		it("should not modify URL without trailing slash", () => {
			const result = cleanBaseUrl("https://api.example.com");
			expect(result).toBe("https://api.example.com");
		});

		it("should handle URL with path", () => {
			const result = cleanBaseUrl("https://api.example.com/v1/");
			expect(result).toBe("https://api.example.com/v1");
		});

		it("should handle empty string", () => {
			const result = cleanBaseUrl("");
			expect(result).toBe("");
		});

		it("should handle just slashes", () => {
			const result = cleanBaseUrl("///");
			expect(result).toBe("");
		});

		it("should preserve internal slashes", () => {
			const result = cleanBaseUrl("https://api.example.com/v1/api/");
			expect(result).toBe("https://api.example.com/v1/api");
		});
	});
});

describe("Runtime Exports", () => {
	it("should export all required functions", async () => {
		const runtime = await import("../src/runtime");

		expect(runtime.mergeRequestParameters).toBeDefined();
		expect(typeof runtime.mergeRequestParameters).toBe("function");

		expect(runtime.stringifyHeaders).toBeDefined();
		expect(typeof runtime.stringifyHeaders).toBe("function");

		expect(runtime.buildQueryString).toBeDefined();
		expect(typeof runtime.buildQueryString).toBe("function");

		expect(runtime.cleanBaseUrl).toBeDefined();
		expect(typeof runtime.cleanBaseUrl).toBe("function");

		expect(runtime.serializeBody).toBeDefined();
		expect(typeof runtime.serializeBody).toBe("function");
	});

	it("should export all required types", () => {
		// This test verifies the types are exported properly
		// by using them - if they don't exist, TypeScript will fail to compile
		// Import types directly
		type QueryParamsType = import("../src/runtime").QueryParams;
		type HttpHeadersType = import("../src/runtime").HttpHeaders;
		type ParamsType = import("../src/runtime").Params;

		// Type assertions to verify exports exist
		const _queryParams: QueryParamsType = { foo: "bar" };
		const _httpHeaders: HttpHeadersType = { "X-Test": "value" };
		const _k6Params: ParamsType = { timeout: "30s" };

		expect(_queryParams).toBeDefined();
		expect(_httpHeaders).toBeDefined();
		expect(_k6Params).toBeDefined();
	});
});

describe("serializeBody", () => {
	it("should pass through null values", () => {
		const result = serializeBody(null);
		expect(result).toBeNull();
	});

	it("should pass through undefined values", () => {
		const result = serializeBody(undefined);
		expect(result).toBeUndefined();
	});

	it("should pass through string values", () => {
		const result = serializeBody("already serialized");
		expect(result).toBe("already serialized");
	});

	it("should pass through empty string", () => {
		const result = serializeBody("");
		expect(result).toBe("");
	});

	it("should pass through JSON string without double-encoding", () => {
		const jsonString = '{"name":"test"}';
		const result = serializeBody(jsonString);
		expect(result).toBe('{"name":"test"}');
	});

	it("should pass through ArrayBuffer", () => {
		const buffer = new ArrayBuffer(8);
		const result = serializeBody(buffer);
		expect(result).toBe(buffer);
		expect(result).toBeInstanceOf(ArrayBuffer);
	});

	it("should pass through FileData-like objects (K6 type with data property)", () => {
		// K6 FileData has a 'data' property
		const fileData = { data: "binary content", filename: "test.txt", content_type: "text/plain" };
		const result = serializeBody(fileData);
		expect(result).toBe(fileData);
	});

	it("should JSON.stringify plain objects", () => {
		const obj = { name: "test", value: 42 };
		const result = serializeBody(obj);
		expect(result).toBe('{"name":"test","value":42}');
	});

	it("should JSON.stringify arrays", () => {
		const arr = [1, 2, 3];
		const result = serializeBody(arr);
		expect(result).toBe("[1,2,3]");
	});

	it("should JSON.stringify nested objects", () => {
		const obj = { user: { name: "test", roles: ["admin", "user"] } };
		const result = serializeBody(obj);
		expect(result).toBe('{"user":{"name":"test","roles":["admin","user"]}}');
	});

	it("should JSON.stringify objects with special characters", () => {
		const obj = { message: 'Hello "world"' };
		const result = serializeBody(obj);
		expect(result).toBe('{"message":"Hello \\"world\\""}');
	});

	it("should JSON.stringify boolean values", () => {
		// Note: booleans are not strings, so they get JSON.stringify'd
		const result = serializeBody(true);
		expect(result).toBe("true");
	});

	it("should JSON.stringify number values", () => {
		// Note: numbers are not strings, so they get JSON.stringify'd
		const result = serializeBody(42);
		expect(result).toBe("42");
	});
});
