// utils/cache.js
// Standard Redis client for Redis Cloud
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;

let redis = null;
if (REDIS_URL) {
  redis = new Redis(REDIS_URL);
  redis.on('error', (err) => {
    console.error('Redis connection error:', err);
  });
} else {
  console.warn('REDIS_URL not provided. Caching is disabled.');
}

// TTL constants (seconds)
const TTL = {
  GROUPS:     60 * 5,   // 5 minutes
  EXPENSES:   60 * 3,   // 3 minutes
  SUMMARY:    60 * 3,   // 3 minutes
  HISTORY:    60 * 5,   // 5 minutes
};

// ── GET from cache ────────────────────────────────────────────────────────────
async function getCache(key) {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    if (!val) return null;
    return JSON.parse(val);
  } catch {
    return null;
  }
}

// ── SET cache with TTL ────────────────────────────────────────────────────────
async function setCache(key, data, ttl = 60) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
  } catch (err) {
    console.error('Redis set error:', err);
  }
}

// ── DELETE single key ─────────────────────────────────────────────────────────
async function delCache(key) {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.error('Redis del error:', err);
  }
}

// ── DELETE multiple keys by pattern (using KEYS — ok for small datasets) ──────
async function delPattern(pattern) {
  if (!redis) return;
  try {
    // Note: KEYS is fine for small datasets. For larger ones, SCAN should be used.
    const keysToDel = await redis.keys(pattern);
    if (keysToDel.length > 0) {
      await redis.del(...keysToDel);
    }
  } catch (err) {
    console.error('Redis delPattern error:', err);
  }
}

// ── Cache key builders ────────────────────────────────────────────────────────
const keys = {
  userGroups:  (userId)   => `groups:user:${userId}`,
  expenses:    (groupId)  => `expenses:group:${groupId}`,
  summary:     (groupId)  => `summary:group:${groupId}`,
  history:     (groupId)  => `history:group:${groupId}`,
};

// ── Invalidate all cache for a group ─────────────────────────────────────────
// Call this whenever expense/settlement is added/updated/deleted
async function invalidateGroup(groupId, userId) {
  await Promise.all([
    delCache(keys.expenses(groupId)),
    delCache(keys.summary(groupId)),
    delCache(keys.history(groupId)),
    // Also invalidate user groups (balance might have changed)
    ...(userId ? [delCache(keys.userGroups(userId))] : []),
  ]);
}

module.exports = { getCache, setCache, delCache, delPattern, invalidateGroup, keys, TTL };