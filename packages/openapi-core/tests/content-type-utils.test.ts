import { describe, expect, it } from "vitest";

import { getResponseParseMethod } from "../src/utils/content-type-utils";

describe("content-type-utils", () => {
	describe("getResponseParseMethod", () => {
		describe("JSON content types", () => {
			it("should return json for application/json", () => {
				const result = getResponseParseMethod("application/json");
				expect(result.method).toBe("json");
				expect(result.isUnknown).toBe(false);
			});

			it("should return json for text/json", () => {
				const result = getResponseParseMethod("text/json");
				expect(result.method).toBe("json");
				expect(result.isUnknown).toBe(false);
			});

			it("should return json for +json suffix", () => {
				const result = getResponseParseMethod("application/vnd.api+json");
				expect(result.method).toBe("json");
				expect(result.isUnknown).toBe(false);
			});

			it("should handle charset parameter", () => {
				const result = getResponseParseMethod("application/json; charset=utf-8");
				expect(result.method).toBe("json");
				expect(result.isUnknown).toBe(false);
			});
		});

		describe("Text content types", () => {
			it("should return text for text/plain", () => {
				const result = getResponseParseMethod("text/plain");
				expect(result.method).toBe("text");
				expect(result.isUnknown).toBe(false);
			});

			it("should return text for text/html", () => {
				const result = getResponseParseMethod("text/html");
				expect(result.method).toBe("text");
				expect(result.isUnknown).toBe(false);
			});

			it("should return text for text/css", () => {
				const result = getResponseParseMethod("text/css");
				expect(result.method).toBe("text");
				expect(result.isUnknown).toBe(false);
			});

			it("should return text for application/xml", () => {
				const result = getResponseParseMethod("application/xml");
				expect(result.method).toBe("text");
				expect(result.isUnknown).toBe(false);
			});

			it("should return text for +xml suffix", () => {
				const result = getResponseParseMethod("application/soap+xml");
				expect(result.method).toBe("text");
				expect(result.isUnknown).toBe(false);
			});

			it("should return text for application/javascript", () => {
				const result = getResponseParseMethod("application/javascript");
				expect(result.method).toBe("text");
				expect(result.isUnknown).toBe(false);
			});
		});

		describe("Binary content types", () => {
			it("should return body for image types", () => {
				expect(getResponseParseMethod("image/png").method).toBe("body");
				expect(getResponseParseMethod("image/jpeg").method).toBe("body");
				expect(getResponseParseMethod("image/gif").method).toBe("body");
			});

			it("should return body for audio types", () => {
				expect(getResponseParseMethod("audio/mpeg").method).toBe("body");
				expect(getResponseParseMethod("audio/wav").method).toBe("body");
			});

			it("should return body for video types", () => {
				expect(getResponseParseMethod("video/mp4").method).toBe("body");
				expect(getResponseParseMethod("video/webm").method).toBe("body");
			});

			it("should return body for font types", () => {
				expect(getResponseParseMethod("font/woff").method).toBe("body");
				expect(getResponseParseMethod("font/woff2").method).toBe("body");
			});

			it("should return body for application/octet-stream", () => {
				const result = getResponseParseMethod("application/octet-stream");
				expect(result.method).toBe("body");
				expect(result.isUnknown).toBe(false);
			});

			it("should return body for application/pdf", () => {
				const result = getResponseParseMethod("application/pdf");
				expect(result.method).toBe("body");
				expect(result.isUnknown).toBe(false);
			});

			it("should return body for archive types", () => {
				expect(getResponseParseMethod("application/zip").method).toBe("body");
				expect(getResponseParseMethod("application/gzip").method).toBe("body");
			});
		});

		describe("Unknown content types", () => {
			it("should use text fallback by default", () => {
				const result = getResponseParseMethod("application/x-custom-type");
				expect(result.method).toBe("text");
				expect(result.isUnknown).toBe(true);
			});

			it("should use specified fallback", () => {
				const result = getResponseParseMethod("application/x-custom-type", "json");
				expect(result.method).toBe("json");
				expect(result.isUnknown).toBe(true);
			});

			it("should handle undefined content type", () => {
				const result = getResponseParseMethod(undefined);
				expect(result.method).toBe("text");
				expect(result.isUnknown).toBe(true);
			});

			it("should handle empty content type", () => {
				const result = getResponseParseMethod("");
				expect(result.method).toBe("text");
				expect(result.isUnknown).toBe(true);
			});
		});

		describe("Case insensitivity", () => {
			it("should handle uppercase content types", () => {
				const result = getResponseParseMethod("APPLICATION/JSON");
				expect(result.method).toBe("json");
			});

			it("should handle mixed case content types", () => {
				const result = getResponseParseMethod("Application/Json");
				expect(result.method).toBe("json");
			});
		});
	});
});
