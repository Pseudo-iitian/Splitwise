const express  = require('express');
const router   = express.Router();
const Expense  = require('../models/Expense');
const auth     = require('../middleware/auth');
const { splitEqually, splitByPercentage, splitByExact } = require('../utils/splitHelpers');

router.post('/', auth, async (req, res) => {
  try {
    const { description, amount, groupId, paidBy, members, splitType, splits } = req.body; // ← paidBy add kiya
    let computedSplits;
    if (splitType === 'equal')           computedSplits = splitEqually(amount, members);
    else if (splitType === 'percentage') computedSplits = splitByPercentage(amount, splits);
    else if (splitType === 'exact')      computedSplits = splitByExact(splits);

    const expense = new Expense({
      description,
      amount,
      paidBy: paidBy || req.user.id,  // ← SIRF YEH LINE CHANGE HUI
      group:  groupId,
      splitType,
      splits: computedSplits
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('paidBy', 'name email')
      .populate('splits.user', 'name email')
      .sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:expenseId — Edit expense
router.put('/:expenseId', auth, async (req, res) => {
  try {
    const { description, amount, paidBy, members, splitType, splits } = req.body;

    let computedSplits;
    if (splitType === 'equal')           computedSplits = splitEqually(amount, members);
    else if (splitType === 'percentage') computedSplits = splitByPercentage(amount, splits);
    else if (splitType === 'exact')      computedSplits = splitByExact(splits);

    const expense = await Expense.findByIdAndUpdate(
      req.params.expenseId,
      {
        description,
        amount,
        paidBy,
        splitType,
        splits: computedSplits
      },
      { new: true }
    ).populate('paidBy', 'name email')
     .populate('splits.user', 'name email');

    if (!expense) return res.status(404).json({ msg: 'Expense not found' });

    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:expenseId — Delete expense
router.delete('/:expenseId', auth, async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.expenseId);
    res.json({ msg: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;