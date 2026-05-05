const express  = require('express');
const router   = express.Router();
const Group    = require('../models/Group');
const Activity = require('../models/Activity');
const auth     = require('../middleware/auth');
const crypto   = require('crypto');
const chatRouter = require('./chat');
router.use('/:groupId/chat', chatRouter);
require('dotenv').config();

const { calculateBalances, calculateDetailedBalances, calculateSettlementSummary } = require('../utils/splitHelpers');
const { getCache, setCache, invalidateGroup, keys, TTL } = require('../utils/cache');

// ─── POST /api/groups — Create group ─────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, members, category } = req.body;
    const group = new Group({
      name, description, category,
      members:   [...(members || []), req.user.id],
      createdBy: req.user.id,
    });
    await group.save();

    // Invalidate user's groups cache
    await invalidateGroup(null, req.user.id);

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/groups — Get all groups for user ────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const cacheKey = keys.userGroups(req.user.id);

    // 1️⃣ Try cache first
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 2️⃣ Cache miss — hit DB
    const groups = await Group.find({ members: req.user.id })
      .populate('members',   'name email upiId upiVerified')
      .populate('createdBy', 'name email');

    // 3️⃣ Store in cache
    await setCache(cacheKey, groups, TTL.GROUPS);

    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/groups/:groupId/balances ───────────────────────────────────────
router.get('/:groupId/balances', auth, async (req, res) => {
  try {
    const balances = await calculateBalances(req.params.groupId);
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/groups/:groupId ─────────────────────────────────────────────
router.delete('/:groupId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Only group creator can delete' });
    }

    await Group.findByIdAndDelete(req.params.groupId);

    // Invalidate caches
    await invalidateGroup(req.params.groupId, req.user.id);

    res.json({ msg: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/groups/:groupId/invite ────────────────────────────────────────
router.post('/:groupId/invite', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    const inviteToken = crypto.randomBytes(16).toString('hex');
    group.inviteToken = inviteToken;
    await group.save();

    const inviteLink = `${process.env.FRONTEND_URL}/join/${inviteToken}`;
    res.json({ inviteLink, token: inviteToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/groups/join/:token ────────────────────────────────────────────
router.post('/join/:token', auth, async (req, res) => {
  try {
    const group = await Group.findOne({ inviteToken: req.params.token });
    if (!group) return res.status(404).json({ msg: 'Invalid or expired invite link' });

    if (group.members.includes(req.user.id)) {
      return res.status(400).json({ msg: 'You are already a member of this group' });
    }

    group.members.push(req.user.id);
    await group.save();

    // Invalidate this user's groups cache
    await invalidateGroup(group._id.toString(), req.user.id);

    res.json({ msg: 'Joined successfully!', group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/groups/:groupId/detailed-balances ──────────────────────────────
router.get('/:groupId/detailed-balances', auth, async (req, res) => {
  try {
    const balances = await calculateDetailedBalances(req.params.groupId);
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/groups/:groupId/settlement-summary ─────────────────────────────
router.get('/:groupId/settlement-summary', auth, async (req, res) => {
  try {
    const cacheKey = keys.summary(req.params.groupId);

    // 1️⃣ Try cache
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // 2️⃣ Cache miss
    const summary = await calculateSettlementSummary(req.params.groupId, req.user.id);

    // 3️⃣ Cache it
    await setCache(cacheKey, summary, TTL.SUMMARY);

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/groups/:groupId/history ────────────────────────────────────────
router.get('/:groupId/history', auth, async (req, res) => {
  try {
    const cacheKey = keys.history(req.params.groupId);

    // 1️⃣ Try cache
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // 2️⃣ Cache miss
    const activities = await Activity.find({ group: req.params.groupId })
      .populate('user', 'name email')
      .sort({ date: -1 })
      .limit(100);

    // 3️⃣ Cache it
    await setCache(cacheKey, activities, TTL.HISTORY);

    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;