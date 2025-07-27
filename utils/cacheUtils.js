/**
 * Cache Utilities
 *
 * Simple in-memory cache implementation for recommendation caching
 * Can be extended to use Redis or other caching solutions
 */

class SimpleCache {
  constructor() {
    this.cache = new Map()
    this.ttl = new Map() // Time to live tracking
  }

  /**
   * Set cache value with TTL
   */
  async setCache(key, value, ttlSeconds = 3600) {
    this.cache.set(key, value)
    this.ttl.set(key, Date.now() + ttlSeconds * 1000)
    return true
  }

  /**
   * Get cache value
   */
  async getCache(key) {
    // Check if expired
    const expiry = this.ttl.get(key)
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key)
      this.ttl.delete(key)
      return null
    }

    return this.cache.get(key) || null
  }

  /**
   * Delete cache value
   */
  async deleteCache(key) {
    this.cache.delete(key)
    this.ttl.delete(key)
    return true
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    this.cache.clear()
    this.ttl.clear()
    return true
  }
}

const cacheInstance = new SimpleCache()

module.exports = {
  setCache: cacheInstance.setCache.bind(cacheInstance),
  getCache: cacheInstance.getCache.bind(cacheInstance),
  deleteCache: cacheInstance.deleteCache.bind(cacheInstance),
  clearCache: cacheInstance.clearCache.bind(cacheInstance),
}
