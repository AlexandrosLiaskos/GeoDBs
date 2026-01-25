/**
 * CacheManager - TTL-based caching layer for performance optimization
 *
 * Provides in-memory caching with time-to-live (TTL) support.
 * Reduces database queries and improves user experience.
 * Automatically invalidates expired entries.
 *
 * @example
 * // Set cache with 5-minute TTL
 * cacheManager.set('filterOptions', data, 5 * 60 * 1000);
 *
 * // Get from cache
 * const data = cacheManager.get('filterOptions');
 *
 * // Check if cached
 * if (cacheManager.has('filterOptions')) {
 *   // Use cached data
 * }
 */

class CacheManager {
    constructor() {
        // Cache storage: Map of key -> { value, timestamp, ttl }
        this.cache = new Map();

        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            invalidations: 0
        };
    }

    /**
     * Set a value in cache with optional TTL
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} [ttl] - Time to live in milliseconds (optional)
     */
    set(key, value, ttl = null) {
        if (!key) {
            console.error('CacheManager.set: Key is required');
            return;
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl
        });

        this.stats.sets++;

        if (window.DEBUG_MODE) {
            console.log(`💾 CacheManager: Set "${key}"`, {
                ttl: ttl ? `${ttl}ms` : 'no expiry',
                size: this._getSize(value)
            });
        }
    }

    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined if not found/expired
     */
    get(key) {
        if (!this.cache.has(key)) {
            this.stats.misses++;

            if (window.DEBUG_MODE) {
                console.log(`💾 CacheManager: Miss "${key}"`);
            }

            return undefined;
        }

        const entry = this.cache.get(key);

        // Check if expired
        if (entry.ttl !== null) {
            const age = Date.now() - entry.timestamp;
            if (age > entry.ttl) {
                this.cache.delete(key);
                this.stats.misses++;

                if (window.DEBUG_MODE) {
                    console.log(`💾 CacheManager: Expired "${key}" (age: ${age}ms, ttl: ${entry.ttl}ms)`);
                }

                return undefined;
            }
        }

        this.stats.hits++;

        if (window.DEBUG_MODE) {
            const age = Date.now() - entry.timestamp;
            console.log(`💾 CacheManager: Hit "${key}" (age: ${age}ms)`);
        }

        return entry.value;
    }

    /**
     * Check if a key exists in cache (and is not expired)
     * @param {string} key - Cache key
     * @returns {boolean} True if key exists and is valid
     */
    has(key) {
        if (!this.cache.has(key)) {
            return false;
        }

        const entry = this.cache.get(key);

        // Check if expired
        if (entry.ttl !== null) {
            const age = Date.now() - entry.timestamp;
            if (age > entry.ttl) {
                this.cache.delete(key);
                return false;
            }
        }

        return true;
    }

    /**
     * Invalidate (remove) a cache entry
     * @param {string} key - Cache key
     * @returns {boolean} True if key was removed
     */
    invalidate(key) {
        const deleted = this.cache.delete(key);

        if (deleted) {
            this.stats.invalidations++;

            if (window.DEBUG_MODE) {
                console.log(`💾 CacheManager: Invalidated "${key}"`);
            }
        }

        return deleted;
    }

    /**
     * Invalidate all cache entries
     */
    invalidateAll() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.invalidations += size;

        if (window.DEBUG_MODE) {
            console.log(`💾 CacheManager: Invalidated all (${size} entries)`);
        }
    }

    /**
     * Invalidate cache entries matching a pattern
     * @param {RegExp|string} pattern - Pattern to match keys against
     */
    invalidatePattern(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        let count = 0;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                count++;
            }
        }

        this.stats.invalidations += count;

        if (window.DEBUG_MODE) {
            console.log(`💾 CacheManager: Invalidated ${count} entries matching pattern "${pattern}"`);
        }

        return count;
    }

    /**
     * Clean up expired entries
     * @returns {number} Number of entries removed
     */
    cleanup() {
        let count = 0;
        const now = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.ttl !== null) {
                const age = now - entry.timestamp;
                if (age > entry.ttl) {
                    this.cache.delete(key);
                    count++;
                }
            }
        }

        if (count > 0 && window.DEBUG_MODE) {
            console.log(`💾 CacheManager: Cleaned up ${count} expired entries`);
        }

        return count;
    }

    /**
     * Get cache statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

        return {
            ...this.stats,
            total,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            invalidations: 0
        };

        if (window.DEBUG_MODE) {
            console.log('💾 CacheManager: Statistics reset');
        }
    }

    /**
     * Get the size of a value (approximate, for logging)
     * @private
     * @param {*} value - Value to measure
     * @returns {string} Human-readable size
     */
    _getSize(value) {
        try {
            const json = JSON.stringify(value);
            const bytes = new Blob([json]).size;

            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        } catch (e) {
            return 'unknown';
        }
    }
}

// Export for ES modules
export default CacheManager;
