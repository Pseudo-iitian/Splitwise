const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const Wishlist = require('../models/Wishlist');
const logActivity = require('../utils/activityLogger');

// ─── GET all wishlist items ───────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const items = await Wishlist.find()
      .populate('addedBy',  'name email')
      .populate('assignedTo', 'name email')
      .populate('boughtBy', 'name email')
      .populate('votes',    'name email')
      .sort({ createdAt: -1 });

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADD a wishlist item ──────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, price, link, category, assignedTo, priority } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    const item = await Wishlist.create({
      title,
      description,
      price:      price      || 0,
      link:       link       || '',
      category:   category   || 'other',
      assignedTo: assignedTo || null,
      priority:   priority   || 'medium',
      addedBy:    req.user.id,
    });

    const populated = await Wishlist.findById(item._id)
      .populate('addedBy',    'name email')
      .populate('assignedTo', 'name email')
      .populate('votes',      'name email');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── TOGGLE VOTE on a wishlist item ──────────────────────────────────────────
router.patch('/:id/vote', auth, async (req, res) => {
  try {
    const item = await Wishlist.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const userId  = req.user.id;
    const hasVoted = item.votes.map(v => v.toString()).includes(userId);

    if (hasVoted) {
      item.votes = item.votes.filter(v => v.toString() !== userId);
    } else {
      item.votes.push(userId);
    }

    await item.save();

    const populated = await Wishlist.findById(item._id)
      .populate('addedBy',    'name email')
      .populate('assignedTo', 'name email')
      .populate('boughtBy',   'name email')
      .populate('votes',      'name email');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── TOGGLE BOUGHT status ─────────────────────────────────────────────────────
router.patch('/:id/bought', auth, async (req, res) => {
  try {
    const item = await Wishlist.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    item.isBought = !item.isBought;
    item.boughtBy  = item.isBought ? req.user.id : null;
    item.boughtAt  = item.isBought ? new Date()  : null;

    await item.save();

    const populated = await Wishlist.findById(item._id)
      .populate('addedBy',    'name email')
      .populate('assignedTo', 'name email')
      .populate('boughtBy',   'name email')
      .populate('votes',      'name email');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── UPDATE a wishlist item ───────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const item = await Wishlist.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Only the person who added it can edit
    if (item.addedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this item' });
    }

    const { title, description, price, link, category, assignedTo, priority } = req.body;

    if (title)       item.title       = title;
    if (description !== undefined) item.description = description;
    if (price  !== undefined) item.price  = price;
    if (link   !== undefined) item.link   = link;
    if (category)    item.category    = category;
    if (assignedTo !== undefined) item.assignedTo = assignedTo || null;
    if (priority)    item.priority    = priority;

    await item.save();

    const populated = await Wishlist.findById(item._id)
      .populate('addedBy',    'name email')
      .populate('assignedTo', 'name email')
      .populate('boughtBy',   'name email')
      .populate('votes',      'name email');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE a wishlist item ───────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Wishlist.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Only the person who added it can delete
    if (item.addedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this item' });
    }

    await item.deleteOne();
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;