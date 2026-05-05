// utils/cache.js
// Upstash Redis — HTTP based, works on Vercel serverless perfectly

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// TTL constants (seconds)
const TTL = {
  GROUPS:     60 * 5,   // 5 minutes
  EXPENSES:   60 * 3,   // 3 minutes
  SUMMARY:    60 * 3,   // 3 minutes
  HISTORY:    60 * 5,   // 5 minutes
};

// ── Low-level Upstash REST call ───────────────────────────────────────────────
async function upstash(command, ...args) {
  if (!REDIS_URL || !REDIS_TOKEN) return null; // Redis not configured — skip silently

  try {
    const res = await fetch(`${REDIS_URL}/${command}/${args.map(a => encodeURIComponent(a)).join('/')}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const data = await res.json();
    return data.result ?? null;
  } catch {
    return null; // Redis error — fallback to DB silently
  }
}

// ── GET from cache ────────────────────────────────────────────────────────────
async function getCache(key) {
  const val = await upstash('get', key);
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

// ── SET cache with TTL ────────────────────────────────────────────────────────
async function setCache(key, data, ttl = 60) {
  await upstash('set', key, JSON.stringify(data), 'EX', ttl);
}

// ── DELETE single key ─────────────────────────────────────────────────────────
async function delCache(key) {
  await upstash('del', key);
}

// ── DELETE multiple keys by pattern (using KEYS — ok for small datasets) ──────
async function delPattern(pattern) {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  try {
    const res = await fetch(`${REDIS_URL}/keys/${encodeURIComponent(pattern)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const data = await res.json();
    const keys = data.result || [];
    await Promise.all(keys.map(k => delCache(k)));
  } catch {}
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