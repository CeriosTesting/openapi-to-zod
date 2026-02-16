import { describe, expect, it } from "vitest";

import { LRUCache } from "../src/utils/lru-cache";

describe("LRUCache", () => {
	it("should store and retrieve values", () => {
		const cache = new LRUCache<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.get("a")).toBe(1);
		expect(cache.get("b")).toBe(2);
	});

	it("should return undefined for missing keys", () => {
		const cache = new LRUCache<string, number>(3);
		expect(cache.get("missing")).toBeUndefined();
	});

	it("should evict least recently used items when capacity exceeded", () => {
		const cache = new LRUCache<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3); // This should evict "a"

		expect(cache.get("a")).toBeUndefined();
		expect(cache.get("b")).toBe(2);
		expect(cache.get("c")).toBe(3);
	});

	it("should update access order on get", () => {
		const cache = new LRUCache<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.get("a"); // Access "a", making "b" the least recently used
		cache.set("c", 3); // This should evict "b"

		expect(cache.get("a")).toBe(1);
		expect(cache.get("b")).toBeUndefined();
		expect(cache.get("c")).toBe(3);
	});

	it("should update existing keys without increasing size", () => {
		const cache = new LRUCache<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("a", 10); // Update "a"

		expect(cache.size()).toBe(2);
		expect(cache.get("a")).toBe(10);
	});

	it("should report correct size", () => {
		const cache = new LRUCache<string, number>(5);
		expect(cache.size()).toBe(0);

		cache.set("a", 1);
		expect(cache.size()).toBe(1);

		cache.set("b", 2);
		expect(cache.size()).toBe(2);
	});

	it("should report capacity", () => {
		const cache = new LRUCache<string, number>(10);
		expect(cache.capacity).toBe(10);
	});

	it("should check if key exists", () => {
		const cache = new LRUCache<string, number>(3);
		cache.set("a", 1);

		expect(cache.has("a")).toBe(true);
		expect(cache.has("b")).toBe(false);
	});

	it("should clear all entries", () => {
		const cache = new LRUCache<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.clear();

		expect(cache.size()).toBe(0);
		expect(cache.get("a")).toBeUndefined();
		expect(cache.get("b")).toBeUndefined();
	});

	it("should handle large number of items", () => {
		const cache = new LRUCache<number, number>(100);
		for (let i = 0; i < 200; i++) {
			cache.set(i, i * 2);
		}

		expect(cache.size()).toBe(100);
		// First 100 items should be evicted
		expect(cache.get(0)).toBeUndefined();
		expect(cache.get(99)).toBeUndefined();
		// Last 100 items should still be present
		expect(cache.get(100)).toBe(200);
		expect(cache.get(199)).toBe(398);
	});
});
