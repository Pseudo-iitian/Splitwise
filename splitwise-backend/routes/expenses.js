const express  = require('express');
const router   = express.Router();
const Expense  = require('../models/Expense');
const Settlement = require('../models/Settlement');
const auth     = require('../middleware/auth');
const { splitEqually, splitByPercentage, splitByExact } = require('../utils/splitHelpers');

async function attachSplitSettlementStatus(expenses) {
  const expenseIds = expenses.map(expense => expense._id);
  const settlements = await Settlement.find({ relatedExpense: { $in: expenseIds } });
  const paidAmounts = {};

  settlements.forEach(settlement => {
    const expenseId = settlement.relatedExpense.toString();
    const payerId = settlement.paidBy.toString();
    const key = `${expenseId}:${payerId}`;
    paidAmounts[key] = +((paidAmounts[key] || 0) + settlement.amount).toFixed(2);
  });

  return expenses.map(expense => {
    const plainExpense = expense.toObject();
    const paidById = plainExpense.paidBy?._id?.toString() || plainExpense.paidBy?.toString();

    plainExpense.splits = plainExpense.splits.map(split => {
      const splitUserId = split.user?._id?.toString() || split.user?.toString();
      const settledAmount = splitUserId === paidById
        ? split.amount
        : (paidAmounts[`${plainExpense._id.toString()}:${splitUserId}`] || 0);

      return {
        ...split,
        settledAmount,
        settled: settledAmount >= split.amount - 0.009
      };
    });

    return plainExpense;
  });
}

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
    res.json(await attachSplitSettlementStatus(expenses));
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
