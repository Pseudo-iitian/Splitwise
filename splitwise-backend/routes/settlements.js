const express    = require('express');
const router     = express.Router();
const Settlement = require('../models/Settlement');
const auth       = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { groupId, paidTo, amount, note } = req.body;
    const settlement = new Settlement({
      group: groupId, paidBy: req.user.id, paidTo, amount, note
    });
    await settlement.save();
    res.status(201).json(settlement);
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

module.exports = router;
