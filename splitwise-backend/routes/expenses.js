const express  = require('express');
const router   = express.Router();
const Expense  = require('../models/Expense');
const Settlement = require('../models/Settlement');
const auth     = require('../middleware/auth');
const { splitEqually, splitByPercentage, splitByExact } = require('../utils/splitHelpers');
const { logActivity } = require('../utils/activityLogger');

async function attachSplitSettlementStatus(expenses) {
  const expenseIds = expenses.map(expense => expense._id);
  const settlements = await Settlement.find({
    $or: [
      { relatedExpense: { $in: expenseIds } },
      { relatedExpenses: { $in: expenseIds } }
    ]
  });
  const paidAmounts = {};

  settlements.forEach(settlement => {
    const payerId = settlement.paidBy.toString();

    if (settlement.relatedExpenses && settlement.relatedExpenses.length > 0) {
      let remainingAmount = settlement.amount;
      settlement.relatedExpenses.forEach(expIdObj => {
        const expId = expIdObj.toString();
        const expense = expenses.find(e => e._id.toString() === expId);
        if (expense) {
          const split = expense.splits.find(s => {
            const userId = s.user?._id?.toString() || s.user?.toString();
            return userId === payerId;
          });
          if (split && remainingAmount > 0) {
            const amountToAllocate = Math.min(split.amount, remainingAmount);
            const key = `${expId}:${payerId}`;
            paidAmounts[key] = +((paidAmounts[key] || 0) + amountToAllocate).toFixed(2);
            remainingAmount -= amountToAllocate;
          }
        }
      });
    } else if (settlement.relatedExpense) {
      const expenseId = settlement.relatedExpense.toString();
      const key = `${expenseId}:${payerId}`;
      paidAmounts[key] = +((paidAmounts[key] || 0) + settlement.amount).toFixed(2);
    }
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
    
    await logActivity({
      groupId,
      userId: req.user.id,
      action: 'added',
      type: 'expense',
      description: `added "${description}"`,
      amount
    });
    
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

    await logActivity({
      groupId: expense.group,
      userId: req.user.id,
      action: 'updated',
      type: 'expense',
      description: `updated "${description}"`,
      amount
    });

    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:expenseId — Delete expense
router.delete('/:expenseId', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) return res.status(404).json({ msg: 'Expense not found' });

    await Expense.findByIdAndDelete(req.params.expenseId);
    
    await logActivity({
      groupId: expense.group,
      userId: req.user.id,
      action: 'deleted',
      type: 'expense',
      description: `deleted "${expense.description}"`,
      amount: expense.amount
    });

    res.json({ msg: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
