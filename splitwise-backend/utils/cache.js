// utils/cache.js
// Standard Redis client for Redis Cloud
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;

let redis = null;
if (REDIS_URL) {
  // Add timeouts so it doesn't hang Vercel if the connection is slow or failing
  redis = new Redis(REDIS_URL, {
    connectTimeout: 5000,     // Wait max 5 seconds to connect
    commandTimeout: 2000,     // Wait max 2 seconds for a command to finish
    maxRetriesPerRequest: 1,  // Don't keep retrying forever
    retryStrategy(times) {
      // Don't reconnect automatically more than 3 times
      if (times > 3) return null; 
      return Math.min(times * 50, 2000);
    }
  });
  
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
// utils/cache.js mein keys object replace karo:
const keys = {
  userGroups:  (userId)            => `groups:user:${userId}`,
  expenses:    (groupId, userId)   => `expenses:group:${groupId}:user:${userId}`,  // ✅ userId add
  summary:     (groupId, userId)   => `summary:group:${groupId}:user:${userId}`,   // ✅ userId add
  settlements: (groupId)           => `settlements:group:${groupId}`,
  history:     (groupId)           => `history:group:${groupId}`,                  // ✅ same rehne do
};

// ── Invalidate all cache for a group ─────────────────────────────────────────
// Call this whenever expense/settlement is added/updated/deleted
// Abhi sirf ek userId invalidate hota hai — sab members ka karna hai
async function invalidateGroup(groupId, userId) {
  const promises = [
    // History sab ke liye same hai — groupId se delete
    groupId ? delCache(keys.history(groupId)) : Promise.resolve(),
    // User ke groups cache
    userId  ? delCache(keys.userGroups(userId)) : Promise.resolve(),
  ];

  // ✅ Expenses aur summary user-specific hain — pattern se delete karo
  if (groupId) {
    promises.push(
      delPattern(`expenses:group:${groupId}:user:*`),  // sab users ka expenses cache clear
      delPattern(`summary:group:${groupId}:user:*`),   // sab users ka summary cache clear
      delCache(keys.settlements(groupId)),
    );
  }

  await Promise.all(promises);
}

module.exports = { getCache, setCache, delCache, delPattern, invalidateGroup, keys, TTL };
