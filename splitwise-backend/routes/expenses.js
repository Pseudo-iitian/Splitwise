const express    = require('express');
const router     = express.Router();
const Expense    = require('../models/Expense');
const Settlement = require('../models/Settlement');
const auth       = require('../middleware/auth');
const { splitEqually, splitByPercentage, splitByExact } = require('../utils/splitHelpers');
const { logActivity }    = require('../utils/activityLogger');
const { getCache, setCache, invalidateGroup, keys, TTL } = require('../utils/cache');

// ── Attach settlement status to expenses ──────────────────────────────────────
async function attachSplitSettlementStatus(expenses) {
  const expenseIds  = expenses.map(e => e._id);
  const settlements = await Settlement.find({
    $or: [
      { relatedExpense:  { $in: expenseIds } },
      { relatedExpenses: { $in: expenseIds } },
    ],
  });

  const paidAmounts = {};

  settlements.forEach(settlement => {
    const payerId = settlement.paidBy.toString();
    if (settlement.relatedExpenses?.length > 0) {
      let remaining = settlement.amount;
      settlement.relatedExpenses.forEach(expIdObj => {
        const expId  = expIdObj.toString();
        const expense = expenses.find(e => e._id.toString() === expId);
        if (expense) {
          const split = expense.splits.find(s => {
            const uid = s.user?._id?.toString() || s.user?.toString();
            return uid === payerId;
          });
          if (split && remaining > 0) {
            const alloc = Math.min(split.amount, remaining);
            const key = `${expId}:${payerId}`;
            paidAmounts[key] = +((paidAmounts[key] || 0) + alloc).toFixed(2);
            remaining -= alloc;
          }
        }
      });
    } else if (settlement.relatedExpense) {
      const expId = settlement.relatedExpense.toString();
      const key   = `${expId}:${payerId}`;
      paidAmounts[key] = +((paidAmounts[key] || 0) + settlement.amount).toFixed(2);
    }
  });

  return expenses.map(expense => {
    const plain     = expense.toObject();
    const paidById  = plain.paidBy?._id?.toString() || plain.paidBy?.toString();

    plain.splits = plain.splits.map(split => {
      const splitUserId   = split.user?._id?.toString() || split.user?.toString();
      const settledAmount = splitUserId === paidById
        ? split.amount
        : (paidAmounts[`${plain._id.toString()}:${splitUserId}`] || 0);

      return { ...split, settledAmount, settled: settledAmount >= split.amount - 0.009 };
    });

    return plain;
  });
}

// ─── POST /api/expenses — Add expense ────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { description, amount, groupId, paidBy, paidByMultiple, members, splitType, splits } = req.body;

    let computedSplits;
    if      (splitType === 'equal')      computedSplits = splitEqually(amount, members);
    else if (splitType === 'percentage') computedSplits = splitByPercentage(amount, splits);
    else if (splitType === 'exact')      computedSplits = splitByExact(splits);

    const expense = new Expense({
      description,
      amount,
      paidBy:         paidByMultiple?.length > 0 ? paidByMultiple[0].user : (paidBy || req.user.id),
      paidByMultiple: paidByMultiple || [],
      group:          groupId,
      splitType,
      splits:         computedSplits,
    });

    await expense.save();

    await logActivity({
      groupId, userId: req.user.id,
      action: 'added', type: 'expense',
      description: `added "${description}"`, amount,
    });

    // 🗑️ Invalidate group caches
    await invalidateGroup(groupId, req.user.id);

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/expenses/group/:groupId — Get expenses ─────────────────────────
router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const cacheKey = keys.expenses(req.params.groupId);

    // 1️⃣ Try cache
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    // 2️⃣ Cache miss — hit DB
    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('paidBy',             'name email')
      .populate('paidByMultiple.user','name email')
      .populate('splits.user',        'name email')
      .sort({ date: -1 });

    const withStatus = await attachSplitSettlementStatus(expenses);

    // 3️⃣ Cache result
    await setCache(cacheKey, withStatus, TTL.EXPENSES);

    res.json(withStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/expenses/:expenseId — Edit expense ──────────────────────────────
router.put('/:expenseId', auth, async (req, res) => {
  try {
    const { description, amount, paidBy, paidByMultiple, members, splitType, splits } = req.body;

    let computedSplits;
    if      (splitType === 'equal')      computedSplits = splitEqually(amount, members);
    else if (splitType === 'percentage') computedSplits = splitByPercentage(amount, splits);
    else if (splitType === 'exact')      computedSplits = splitByExact(splits);

    const updateData = { description, amount, splitType, splits: computedSplits };
    if (paidByMultiple?.length > 0) {
      updateData.paidByMultiple = paidByMultiple;
      updateData.paidBy         = paidByMultiple[0].user;
    } else if (paidBy) {
      updateData.paidBy         = paidBy;
      updateData.paidByMultiple = [];
    }

    const expense = await Expense.findByIdAndUpdate(req.params.expenseId, updateData, { new: true })
      .populate('paidBy',             'name email')
      .populate('paidByMultiple.user','name email')
      .populate('splits.user',        'name email');

    if (!expense) return res.status(404).json({ msg: 'Expense not found' });

    await logActivity({
      groupId: expense.group, userId: req.user.id,
      action: 'updated', type: 'expense',
      description: `updated "${description}"`, amount,
    });

    // 🗑️ Invalidate
    await invalidateGroup(expense.group.toString(), req.user.id);

    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/expenses/:expenseId — Delete expense ────────────────────────
router.delete('/:expenseId', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) return res.status(404).json({ msg: 'Expense not found' });

    await Expense.findByIdAndDelete(req.params.expenseId);

    await logActivity({
      groupId: expense.group, userId: req.user.id,
      action: 'deleted', type: 'expense',
      description: `deleted "${expense.description}"`, amount: expense.amount,
    });

    // 🗑️ Invalidate
    await invalidateGroup(expense.group.toString(), req.user.id);

    res.json({ msg: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;