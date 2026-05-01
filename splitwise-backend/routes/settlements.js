const express    = require('express');
const router     = express.Router();
const Settlement = require('../models/Settlement');
const Group      = require('../models/Group');
const auth       = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { groupId, paidBy, paidTo, amount, note } = req.body;
    const paymentAmount = Number(amount);

    if (!groupId || !paidTo || !paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ msg: 'Group, paid to, and valid amount are required' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    const payerId = paidBy || req.user.id;
    const memberIds = group.members.map(member => member.toString());

    if (!memberIds.includes(req.user.id)) {
      return res.status(403).json({ msg: 'You are not a member of this group' });
    }
    if (!memberIds.includes(payerId) || !memberIds.includes(paidTo)) {
      return res.status(400).json({ msg: 'Both users must be group members' });
    }
    if (payerId === paidTo) {
      return res.status(400).json({ msg: 'Payer and receiver cannot be same' });
    }

    const settlement = new Settlement({
      group: groupId,
      paidBy: payerId,
      paidTo,
      amount: paymentAmount,
      note
    });
    await settlement.save();

    const populatedSettlement = await settlement.populate([
      { path: 'paidBy', select: 'name email' },
      { path: 'paidTo', select: 'name email' }
    ]);

    res.status(201).json(populatedSettlement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const settlements = await Settlement.find({ group: req.params.groupId })
      .populate('paidBy', 'name email')
      .populate('paidTo', 'name email')
      .sort({ date: -1 });
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:settlementId', auth, async (req, res) => {
  try {
    const { amount, note } = req.body;
    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ msg: 'Valid amount is required' });
    }

    const settlement = await Settlement.findById(req.params.settlementId);
    if (!settlement) return res.status(404).json({ msg: 'Payment not found' });

    const group = await Group.findById(settlement.group);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    const memberIds = group.members.map(member => member.toString());
    if (!memberIds.includes(req.user.id)) {
      return res.status(403).json({ msg: 'You are not a member of this group' });
    }

    settlement.amount = paymentAmount;
    if (note !== undefined) settlement.note = note;
    await settlement.save();

    const populatedSettlement = await settlement.populate([
      { path: 'paidBy', select: 'name email' },
      { path: 'paidTo', select: 'name email' }
    ]);

    res.json(populatedSettlement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:settlementId', auth, async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.settlementId);
    if (!settlement) return res.status(404).json({ msg: 'Payment not found' });

    const group = await Group.findById(settlement.group);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    const memberIds = group.members.map(member => member.toString());
    if (!memberIds.includes(req.user.id)) {
      return res.status(403).json({ msg: 'You are not a member of this group' });
    }

    await Settlement.findByIdAndDelete(req.params.settlementId);
    res.json({ msg: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
