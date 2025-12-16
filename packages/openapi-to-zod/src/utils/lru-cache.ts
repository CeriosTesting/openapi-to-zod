/**
 * @shared Simple LRU Cache implementation for performance optimization
 * @since 1.0.0
 * Utility used by core and playwright packages
 * Prevents memory leaks from unbounded cache growth
 */
export class LRUCache<K, V> {
	private cache = new Map<K, V>();
	private maxSize: number;

	constructor(maxSize: number) {
		this.maxSize = maxSize;
	}

	get capacity(): number {
		return this.maxSize;
	}

	get(key: K): V | undefined {
		if (!this.cache.has(key)) return undefined;
		// Move to end (most recently used)
		const value = this.cache.get(key);
		if (value === undefined) return undefined;
		this.cache.delete(key);
		this.cache.set(key, value);
		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			// Remove least recently used (first item)
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) {
				this.cache.delete(firstKey);
			}
		}
		this.cache.set(key, value);
	}

	has(key: K): boolean {
		return this.cache.has(key);
	}

	clear(): void {
		this.cache.clear();
	}

	size(): number {
		return this.cache.size;
	}
}
