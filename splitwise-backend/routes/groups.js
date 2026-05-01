const express  = require('express');
const router   = express.Router();
const Group    = require('../models/Group');
const auth     = require('../middleware/auth');
const { calculateBalances } = require('../utils/splitHelpers');
const crypto = require('crypto');
require('dotenv').config();


router.post('/', auth, async (req, res) => {
  try {
    const { name, description, members, category } = req.body;
    const group = new Group({
      name, description, category,
      members: [...(members || []), req.user.id],
      createdBy: req.user.id
    });
    await group.save();
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id })
      .populate('members', 'name email')
      .populate('createdBy', 'name email');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:groupId/balances', auth, async (req, res) => {
  try {
    const balances = await calculateBalances(req.params.groupId);
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:groupId — Delete a group
router.delete('/:groupId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    // Sirf creator delete kar sakta hai
    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Only group creator can delete' });
    }

    await Group.findByIdAndDelete(req.params.groupId);
    res.json({ msg: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:groupId/invite — Generate invite link
router.post('/:groupId/invite', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    // Unique token generate karo
    const inviteToken = crypto.randomBytes(16).toString('hex');
    group.inviteToken = inviteToken;
    await group.save();


    //change here...
    const inviteLink = `${process.env.FRONTEND_URL}/join/${inviteToken}`;
    res.json({ inviteLink, token: inviteToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/join/:token — Join group via invite link
router.post('/join/:token', auth, async (req, res) => {
  try {
    console.log("Incoming token:", req.params.token);
    const group = await Group.findOne({ inviteToken: req.params.token });
    console.log("Group found:", group);

    if (!group) return res.status(404).json({ msg: 'Invalid or expired invite link' });

    // Already member hai?
    if (group.members.includes(req.user.id)) {
      return res.status(400).json({ msg: 'You are already a member of this group' });
    }

    group.members.push(req.user.id);
    await group.save();

    res.json({ msg: 'Joined successfully!', group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
