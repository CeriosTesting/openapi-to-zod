import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Runtime validation tests for the newly implemented string formats:
 * hostname, uri-reference, byte, and binary
 */
describe("New String Formats - Runtime Validation", () => {
	describe("hostname format", () => {
		const hostnameSchema = z
			.string()
			.refine(val => /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)*(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/.test(val), {
				message: "Must be a valid hostname",
			});

		it("should accept valid hostnames", () => {
			expect(hostnameSchema.safeParse("example.com").success).toBe(true);
			expect(hostnameSchema.safeParse("api.example.com").success).toBe(true);
			expect(hostnameSchema.safeParse("sub.api.example.com").success).toBe(true);
			expect(hostnameSchema.safeParse("localhost").success).toBe(true);
			expect(hostnameSchema.safeParse("my-server.example.com").success).toBe(true);
			expect(hostnameSchema.safeParse("123.example.com").success).toBe(true);
		});

		it("should reject invalid hostnames", () => {
			expect(hostnameSchema.safeParse("-example.com").success).toBe(false); // starts with hyphen
			expect(hostnameSchema.safeParse("example-.com").success).toBe(false); // label ends with hyphen
			expect(hostnameSchema.safeParse("example..com").success).toBe(false); // double dot
			expect(hostnameSchema.safeParse("").success).toBe(false); // empty
			expect(hostnameSchema.safeParse("example.com:8080").success).toBe(false); // port included
			expect(hostnameSchema.safeParse("http://example.com").success).toBe(false); // scheme included
		});
	});

	describe("uri-reference format", () => {
		const uriRefSchema = z.string().refine(val => !/\s/.test(val), { message: "Must be a valid URI reference" });

		it("should accept absolute URIs", () => {
			expect(uriRefSchema.safeParse("https://example.com").success).toBe(true);
			expect(uriRefSchema.safeParse("http://example.com:8080/path").success).toBe(true);
			expect(uriRefSchema.safeParse("ftp://files.example.com/file.txt").success).toBe(true);
			expect(uriRefSchema.safeParse("mailto:user@example.com").success).toBe(true);
		});

		it("should accept relative URIs", () => {
			expect(uriRefSchema.safeParse("/api/v1/users").success).toBe(true);
			expect(uriRefSchema.safeParse("/api/v1/users?page=1").success).toBe(true);
			expect(uriRefSchema.safeParse("/api/v1/users#section").success).toBe(true);
			expect(uriRefSchema.safeParse("../parent/resource").success).toBe(true);
			expect(uriRefSchema.safeParse("?query=value").success).toBe(true);
			expect(uriRefSchema.safeParse("#fragment").success).toBe(true);
		});

		it("should accept URI with all components", () => {
			expect(
				uriRefSchema.safeParse("https://user@example.com:8080/path/to/resource?key=value&foo=bar#section").success
			).toBe(true);
		});

		it("should reject URIs with whitespace", () => {
			expect(uriRefSchema.safeParse("https://example .com").success).toBe(false);
			expect(uriRefSchema.safeParse("http://example.com/path with spaces").success).toBe(false);
		});
	});

	describe("byte format", () => {
		const byteSchema = z.base64();

		it("should accept valid base64 strings", () => {
			expect(byteSchema.safeParse("QmFzZTY0").success).toBe(true);
			expect(byteSchema.safeParse("SGVsbG8gV29ybGQ=").success).toBe(true);
			expect(byteSchema.safeParse("VGVzdCBEYXRh").success).toBe(true);
			expect(byteSchema.safeParse("").success).toBe(true); // empty is valid base64
		});

		it("should reject invalid base64 strings", () => {
			expect(byteSchema.safeParse("Not@Base64!").success).toBe(false);
			expect(byteSchema.safeParse("Invalid===").success).toBe(false);
		});
	});

	describe("binary format", () => {
		const binarySchema = z.string();

		it("should accept any string (binary is unconstrained)", () => {
			expect(binarySchema.safeParse("any string").success).toBe(true);
			expect(binarySchema.safeParse("").success).toBe(true);
			expect(binarySchema.safeParse("🎉").success).toBe(true);
			expect(binarySchema.safeParse("line1\nline2").success).toBe(true);
		});
	});
});
