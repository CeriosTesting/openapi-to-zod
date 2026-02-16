import { join } from "node:path";

import {
	createTypeScriptLoader,
	escapeJSDoc,
	executeBatch,
	formatConfigValidationError,
	type Generator,
	LRUCache,
	toPascalCase,
} from "@cerios/openapi-core";
import { describe, expect, it } from "vitest";

/**
 * @shared Tests for shared utility exports
 * These utilities are exported from the core package for use by other packages like openapi-to-zod-playwright
 *
 * @since 1.0.0
 */
describe("Shared Utilities", () => {
	describe("LRUCache", () => {
		it("should create cache with specified capacity", () => {
			const cache = new LRUCache<string, number>(3);
			expect(cache).toBeDefined();
		});

		it("should store and retrieve values", () => {
			const cache = new LRUCache<string, number>(3);
			cache.set("a", 1);
			cache.set("b", 2);

			expect(cache.get("a")).toBe(1);
			expect(cache.get("b")).toBe(2);
		});

		it("should return undefined for non-existent keys", () => {
			const cache = new LRUCache<string, number>(3);
			expect(cache.get("nonexistent")).toBeUndefined();
		});

		it("should evict least recently used items when capacity is exceeded", () => {
			const cache = new LRUCache<string, number>(2);
			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3); // This should evict "a"

			expect(cache.get("a")).toBeUndefined();
			expect(cache.get("b")).toBe(2);
			expect(cache.get("c")).toBe(3);
		});

		it("should update LRU order on access", () => {
			const cache = new LRUCache<string, number>(2);
			cache.set("a", 1);
			cache.set("b", 2);

			// Access "a" to make it most recently used
			cache.get("a");

			// Add "c", should evict "b" (not "a")
			cache.set("c", 3);

			expect(cache.get("a")).toBe(1);
			expect(cache.get("b")).toBeUndefined();
			expect(cache.get("c")).toBe(3);
		});

		it("should handle has() method correctly", () => {
			const cache = new LRUCache<string, number>(3);
			cache.set("a", 1);

			expect(cache.has("a")).toBe(true);
			expect(cache.has("b")).toBe(false);
		});

		it("should support clear() method", () => {
			const cache = new LRUCache<string, number>(3);
			cache.set("a", 1);
			cache.set("b", 2);

			cache.clear();

			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(false);
		});
	});

	describe("toPascalCase", () => {
		it("should convert kebab-case to PascalCase", () => {
			expect(toPascalCase("my-api-client")).toBe("MyApiClient");
			expect(toPascalCase("user-name")).toBe("UserName");
		});

		it("should convert snake_case to PascalCase", () => {
			expect(toPascalCase("user_name")).toBe("UserName");
			expect(toPascalCase("api_key")).toBe("ApiKey");
		});

		it("should convert delimited strings to PascalCase with proper capitalization", () => {
			// Function splits on delimiters and capitalizes each word
			expect(toPascalCase("user-api")).toBe("UserApi");
			expect(toPascalCase("XML_Parser")).toBe("XMLParser");
			expect(toPascalCase("simple_text")).toBe("SimpleText");
		});
		it("should handle strings starting with numbers", () => {
			expect(toPascalCase("2fa-code")).toBe("N2faCode");
			expect(toPascalCase("123abc")).toBe("N123abc");
		});

		it("should handle empty or invalid strings", () => {
			expect(toPascalCase("")).toBe("Value");
			expect(toPascalCase("___")).toBe("Value");
		});

		it("should convert numbers to strings", () => {
			expect(toPascalCase(404)).toBe("N404");
			expect(toPascalCase(200)).toBe("N200");
		});

		it("should handle spaces and dots", () => {
			expect(toPascalCase("user name")).toBe("UserName");
			expect(toPascalCase("api.client")).toBe("ApiClient");
		});
	});

	describe("escapeJSDoc", () => {
		it("should escape JSDoc comment terminators", () => {
			expect(escapeJSDoc("Comment with */ terminator")).toBe("Comment with *\\/ terminator");
		});

		it("should handle multiple occurrences", () => {
			expect(escapeJSDoc("First */ and second */")).toBe("First *\\/ and second *\\/");
		});

		it("should handle strings without terminators", () => {
			expect(escapeJSDoc("Normal comment")).toBe("Normal comment");
		});

		it("should handle empty strings", () => {
			expect(escapeJSDoc("")).toBe("");
		});
	});

	describe("formatConfigValidationError", () => {
		it("should format Zod validation errors with correct structure", () => {
			// Create a mock ZodError
			const mockError = {
				issues: [
					{
						path: ["specs", 0, "input"],
						message: "Required",
					},
					{
						path: ["mode"],
						message: "Invalid enum value",
					},
				],
			};

			const result = formatConfigValidationError(mockError as any, "/path/to/config.ts", "/path/to/config.ts", {
				additionalNotes: ["Note: schemaType is always 'all' for Playwright generator"],
			});

			expect(result).toContain("Invalid configuration file");
			expect(result).toContain("/path/to/config.ts");
			expect(result).toContain("Validation errors:");
			expect(result).toContain("specs.0.input: Required");
			expect(result).toContain("mode: Invalid enum value");
			expect(result).toContain("Note: schemaType is always 'all' for Playwright generator");
		});

		it("should format errors with empty path as 'root'", () => {
			const mockError = {
				issues: [
					{
						path: [],
						message: "Must be an object",
					},
				],
			};

			const result = formatConfigValidationError(mockError as any, "/path/to/config.ts", "/path/to/config.ts");

			expect(result).toContain("root: Must be an object");
		});

		it("should include additional notes when provided", () => {
			const mockError = {
				issues: [
					{
						path: ["test"],
						message: "Error",
					},
				],
			};

			const result = formatConfigValidationError(mockError as any, "/path/to/config.ts", undefined, {
				additionalNotes: ["Note 1", "Note 2"],
			});

			expect(result).toContain("Note 1");
			expect(result).toContain("Note 2");
		});
	});

	describe("createTypeScriptLoader", () => {
		it("should create a loader function", () => {
			const loader = createTypeScriptLoader();
			expect(loader).toBeDefined();
			expect(typeof loader).toBe("function");
		});

		it("should transpile TypeScript config files", async () => {
			const configPath = join(__dirname, "fixtures", "config-files", "openapi-to-zod.config.ts");

			const loader = createTypeScriptLoader();
			const result = await loader(configPath, "");

			expect(result).toBeDefined();
			expect(result.specs).toBeDefined();
			expect(result.specs).toHaveLength(2);
			expect(result.specs[0].input).toBe("tests/fixtures/simple.yaml");
			expect(result.specs[0].outputTypes).toBe("tests/output/simple-from-ts-config.ts");
			expect(result.specs[1].prefix).toBe("api");
			expect(result.defaults?.mode).toBe("strict");
			expect(result.executionMode).toBe("parallel");
		});
	});

	describe("executeBatch with Generator interface", () => {
		it("should execute generators sequentially", async () => {
			const executionOrder: number[] = [];

			class TestGenerator implements Generator {
				constructor(private id: number) {}
				generate(): void {
					executionOrder.push(this.id);
				}
			}

			const specs = [1, 2, 3];
			await executeBatch(specs, "sequential", spec => new TestGenerator(spec), 10);

			expect(executionOrder).toEqual([1, 2, 3]);
		});

		it("should execute generators in parallel", async () => {
			const executionOrder: number[] = [];

			class TestGenerator implements Generator {
				constructor(private id: number) {}
				generate(): void {
					executionOrder.push(this.id);
				}
			}

			const specs = [1, 2, 3];
			await executeBatch(specs, "parallel", spec => new TestGenerator(spec), 10);

			// In parallel mode, all should execute (order may vary)
			expect(executionOrder.length).toBe(3);
			expect(executionOrder).toContain(1);
			expect(executionOrder).toContain(2);
			expect(executionOrder).toContain(3);
		});

		it("should support factory pattern for generator creation", async () => {
			let factoryCallCount = 0;

			class TestGenerator implements Generator {
				constructor() {
					factoryCallCount++;
				}
				generate(): void {
					// empty
				}
			}

			const specs = [1, 2, 3];
			await executeBatch(specs, "sequential", () => new TestGenerator(), 10);

			expect(factoryCallCount).toBe(3);
		});

		it("should throw error for empty spec arrays", async () => {
			class TestGenerator implements Generator {
				generate(): void {
					throw new Error("Should not be called");
				}
			}

			await expect(async () => {
				await executeBatch([], "sequential", () => new TestGenerator(), 10);
			}).rejects.toThrow("No specs provided for batch execution");
		});
	});
});
