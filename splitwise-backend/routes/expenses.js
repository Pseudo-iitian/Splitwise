const express    = require('express');
const router     = express.Router();
const Expense    = require('../models/Expense');
const auth       = require('../middleware/auth');
const { splitEqually, splitByPercentage, splitByExact } = require('../utils/splitHelpers');
const { logActivity }    = require('../utils/activityLogger');
const { getCache, setCache, invalidateGroup, keys, TTL } = require('../utils/cache');
const Group = require('../models/Group');
const { sendExpenseNotificationEmail } = require('../utils/emailService');

// ── Attach settlement status to expenses ──────────────────────────────────────
// Simply trust the `settled` field stored in the DB splits.
// The settlements.js route updates splits.settled on create/update/delete.
async function attachSplitSettlementStatus(expenses) {
  return expenses.map(expense => {
    const plain    = expense.toObject();
    const paidById = plain.paidBy?._id?.toString() || plain.paidBy?.toString();

    plain.splits = plain.splits.map(split => {
      const splitUserId = split.user?._id?.toString() || split.user?.toString();
      // Payer is always considered settled (they paid!)
      const isPayer     = splitUserId === paidById;
      const settled     = isPayer || !!split.settled;
      const settledAmount = settled ? split.amount : 0;
      return { ...split, settledAmount, settled };
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

    // 📧 Send email notifications to all group members
    try {
      const groupInfo = await Group.findById(groupId).populate('members', 'name email');
      if (groupInfo) {
        const recipientEmails = groupInfo.members.map(member => member.email);
        
        const addedByUser = groupInfo.members.find(member => member._id.toString() === req.user.id);
        const addedByName = addedByUser ? addedByUser.name : 'A member';

        // Fire and forget email sending
        sendExpenseNotificationEmail(
          recipientEmails,
          groupInfo.name,
          description,
          amount,
          addedByName
        );
      }
    } catch (emailErr) {
      console.error('Failed to trigger email notification:', emailErr);
    }

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/expenses/group/:groupId — Get expenses ─────────────────────────
// GET /api/expenses/group/:groupId
router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const cacheKey = keys.expenses(req.params.groupId, req.user.id); // ✅ userId pass karo

    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('paidBy',              'name email')
      .populate('paidByMultiple.user', 'name email')
      .populate('splits.user',         'name email')
      .sort({ date: -1 });

    const withStatus = await attachSplitSettlementStatus(expenses);

    await setCache(cacheKey, withStatus, TTL.EXPENSES); // ✅ user-specific cache

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