const express    = require('express');
const router     = express.Router();
const Settlement = require('../models/Settlement');
const Group      = require('../models/Group');
const Expense    = require('../models/Expense');
const auth       = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { getCache, setCache, invalidateGroup, keys, TTL } = require('../utils/cache');
const { generateUPILink } = require('../utils/splitHelpers');

// Helper: mark a user's split as settled/unsettled across a list of expense IDs
async function markSplitsSettled(expenseIds, userId, settled) {
  if (!expenseIds || expenseIds.length === 0) return;
  for (const expId of expenseIds) {
    await Expense.updateOne(
      { _id: expId, 'splits.user': userId },
      { $set: { 'splits.$.settled': settled } }
    );
  }
}

async function markLinkedExpenseSettled(expenseId, payerId, payeeId) {
  const exp = await Expense.findById(expenseId);
  if (!exp) return;

  const expPayerId = exp.paidBy?.toString();
  if (expPayerId === payeeId.toString()) {
    await Expense.updateOne(
      { _id: expenseId, 'splits.user': payerId },
      { $set: { 'splits.$.settled': true } }
    );
  }
  if (expPayerId === payerId.toString()) {
    await Expense.updateOne(
      { _id: expenseId, 'splits.user': payeeId },
      { $set: { 'splits.$.settled': true } }
    );
  }
}

async function findDuplicateSettlement(groupId, payerId, payeeId, expenseId) {
  return Settlement.findOne({
    group: groupId,
    paidBy: payerId,
    paidTo: payeeId,
    $or: [
      { relatedExpenses: expenseId },
      { relatedExpense: expenseId },
    ],
  });
}

async function validateRelatedExpenses(relatedExpenses, groupId, payerId, payeeId, options = {}) {
  if (!relatedExpenses || !Array.isArray(relatedExpenses) || relatedExpenses.length === 0) return [];

  const validExpenseIds = [];
  for (const expenseId of relatedExpenses) {
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      const err = new Error(`Related expense ${expenseId} not found`);
      err.status = 404; throw err;
    }
    if (expense.group.toString() !== groupId.toString()) {
      const err = new Error('Related expense must belong to the same group');
      err.status = 400; throw err;
    }
    if (expense.paidBy.toString() !== payeeId.toString()) {
      const err = new Error('Related expense must be paid by the receiver');
      err.status = 400; throw err;
    }
    const payerSplit = expense.splits.find(split => split.user.toString() === payerId.toString());
    if (!payerSplit) {
      const err = new Error('Payer must be included in the related expense split');
      err.status = 400; throw err;
    }
    if (options.requireUnsettled && payerSplit.settled) {
      const err = new Error('This split is already marked as paid');
      err.status = 409; throw err;
    }
    if (options.preventDuplicateSettlement) {
      const duplicate = await findDuplicateSettlement(groupId, payerId, payeeId, expense._id);
      if (duplicate) {
        const err = new Error('A payment is already recorded for this split');
        err.status = 409; throw err;
      }
    }
    validExpenseIds.push(expense._id);
  }
  return validExpenseIds;
}

// ─── POST /api/settlements ────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { groupId, paidBy, paidTo, amount, note, relatedExpense, relatedExpenses, isExpenseUpdate } = req.body;
    const paymentAmount = Number(amount);

    if (!groupId || !paidTo || !paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ msg: 'Group, paid to, and valid amount are required' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    const payerId   = paidBy || req.user.id;
    const memberIds = group.members.map(m => m.toString());

    if (!memberIds.includes(req.user.id))
      return res.status(403).json({ msg: 'You are not a member of this group' });
    if (!memberIds.includes(payerId) || !memberIds.includes(paidTo))
      return res.status(400).json({ msg: 'Both users must be group members' });
    if (payerId === paidTo)
      return res.status(400).json({ msg: 'Payer and receiver cannot be same' });

    const requestedExpenseIds = relatedExpenses && Array.isArray(relatedExpenses)
      ? relatedExpenses
      : relatedExpense
        ? [relatedExpense]
        : [];

    if (requestedExpenseIds.length > 0) {
      const duplicates = [];
      for (const expenseId of requestedExpenseIds) {
        const duplicate = await findDuplicateSettlement(groupId, payerId, paidTo, expenseId);
        if (!duplicate) break;
        duplicates.push({ expenseId, settlement: duplicate });
      }

      if (duplicates.length === requestedExpenseIds.length) {
        for (const { expenseId } of duplicates) {
          await markLinkedExpenseSettled(expenseId, payerId, paidTo);
        }
        await invalidateGroup(groupId, req.user.id);

        const populatedSettlement = await Settlement.findById(duplicates[0].settlement._id).populate([
          { path: 'paidBy',            select: 'name email' },
          { path: 'paidTo',            select: 'name email upiId upiVerified upiVerificationStatus' },
          { path: 'relatedExpenses',   select: 'description amount' },
          { path: 'relatedExpense',    select: 'description amount' },
        ]);

        // Add UPI payment link if payee has a valid UPI handle
        if (populatedSettlement.paidTo.upiId && populatedSettlement.paidTo.upiVerificationStatus !== 'none') {
          populatedSettlement._doc.upiLink = generateUPILink(
            populatedSettlement.paidTo.upiId,
            populatedSettlement.paidTo.name,
            populatedSettlement.amount,
            `Settlement: ${populatedSettlement.note || 'Splitwise Payment'}`
          );
        }

        const payload = populatedSettlement.toObject();
        payload.alreadyRecorded = true;
        return res.status(200).json(payload);
      }
    }

    let expenseIds = [];
    if (relatedExpenses && Array.isArray(relatedExpenses)) {
      expenseIds = await validateRelatedExpenses(relatedExpenses, groupId, payerId, paidTo, {
        requireUnsettled: true,
        preventDuplicateSettlement: true
      });
    } else if (relatedExpense) {
      expenseIds = await validateRelatedExpenses([relatedExpense], groupId, payerId, paidTo, {
        requireUnsettled: true,
        preventDuplicateSettlement: true
      });
    }

    const settlement = new Settlement({
      group: groupId, paidBy: payerId, paidTo,
      amount: paymentAmount, relatedExpenses: expenseIds,
      isExpenseUpdate: isExpenseUpdate || false, note,
    });
    await settlement.save();

    // ✅ Mark payer's splits as settled in all linked expenses
    for (const expId of expenseIds) {
      await markLinkedExpenseSettled(expId, payerId, paidTo);
    }

    // ✅ NET-SETTLEMENT OFFSET LOGIC
    // When Abhishek pays Sahil ₹326.20 (net of ₹637.80 - ₹311.60),
    // the ₹311.60 difference means Sahil's debts to Abhishek are "cancelled out".
    // So mark Sahil's splits as settled in expenses paid by Abhishek.
    const autoSettledExpenseIds = [];
    if (expenseIds.length > 0) {
      // Calculate paidBy's total share in the linked relatedExpenses
      let paidByTotalShare = 0;
      for (const expId of expenseIds) {
        const exp = await Expense.findById(expId);
        if (!exp) continue;
        if (exp.paidBy?.toString() === paidTo.toString()) {
          const split = exp.splits.find(s => s.user?.toString() === payerId.toString());
          if (split) paidByTotalShare += split.amount;
        }
      }

      const offsetAmount = +(paidByTotalShare - paymentAmount).toFixed(2);

      if (offsetAmount > 0.009) {
        // Find expenses paid by payerId where paidTo has unsettled splits
        const reverseExpenses = await Expense.find({ group: groupId, paidBy: payerId });
        let remaining = offsetAmount;

        for (const exp of reverseExpenses) {
          if (remaining <= 0.009) break;
          const split = exp.splits.find(
            s => s.user?.toString() === paidTo.toString() && !s.settled
          );
          if (split && split.amount <= remaining + 0.009) {
            await Expense.updateOne(
              { _id: exp._id, 'splits.user': paidTo },
              { $set: { 'splits.$.settled': true } }
            );
            autoSettledExpenseIds.push(exp._id);
            remaining = +(remaining - split.amount).toFixed(2);
          }
        }

        // Store auto-settled expenses in the settlement for revert on delete
        if (autoSettledExpenseIds.length > 0) {
          await Settlement.findByIdAndUpdate(settlement._id, {
            $set: { autoSettledExpenses: autoSettledExpenseIds }
          });
        }
      }
    }

    const populatedSettlement = await Settlement.findById(settlement._id).populate([
      { path: 'paidBy',            select: 'name email' },
      { path: 'paidTo',            select: 'name email upiId upiVerified upiVerificationStatus' },
      { path: 'relatedExpenses',   select: 'description amount' },
    ]);

    // Add UPI payment link if payee has a usable UPI ID
    if (populatedSettlement.paidTo.upiId && populatedSettlement.paidTo.upiVerificationStatus !== 'none') {
      populatedSettlement._doc.upiLink = generateUPILink(
        populatedSettlement.paidTo.upiId,
        populatedSettlement.paidTo.name,
        populatedSettlement.amount,
        `Settlement: ${populatedSettlement.note || 'Splitwise Payment'}`
      );
    }

    await logActivity({
      groupId, userId: req.user.id,
      action: isExpenseUpdate ? 'marked_paid' : 'paid',
      type: 'settlement',
      description: isExpenseUpdate
        ? `marked a split as paid`
        : `paid ₹${paymentAmount} to ${populatedSettlement.paidTo.name}`,
      amount: paymentAmount,
    });

    // ✅ Invalidate cache
    await invalidateGroup(groupId, req.user.id);

    res.status(201).json(populatedSettlement);
  } catch (err) {
    res.status(err.status || 500).json(err.status ? { msg: err.message } : { error: err.message });
  }
});

// ─── GET /api/settlements/group/:groupId ──────────────────────────────────────
router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const cacheKey = keys.settlements(req.params.groupId);

    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const settlements = await Settlement.find({ group: req.params.groupId })
      .populate('paidBy',          'name email')
      .populate('paidTo',          'name email upiId upiVerified upiVerificationStatus')
      .populate('relatedExpense',  'description amount splits paidBy')  // ✅ splits add
      .populate('relatedExpenses', 'description amount splits paidBy')  // ✅ splits add
      .sort({ date: -1 });

    // Add UPI links to settlements
    settlements.forEach(settlement => {
      if (settlement.paidTo.upiId && settlement.paidTo.upiVerificationStatus !== 'none') {
        settlement._doc.upiLink = generateUPILink(
          settlement.paidTo.upiId,
          settlement.paidTo.name,
          settlement.amount,
          `Settlement: ${settlement.note || 'Splitwise Payment'}`
        );
      }
    });

    await setCache(cacheKey, settlements, TTL.SUMMARY);

    res.json(settlements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/settlements/:settlementId ───────────────────────────────────────
router.put('/:settlementId', auth, async (req, res) => {
  try {
    const { amount, note, relatedExpense, relatedExpenses } = req.body;
    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0)
      return res.status(400).json({ msg: 'Valid amount is required' });

    const settlement = await Settlement.findById(req.params.settlementId);
    if (!settlement) return res.status(404).json({ msg: 'Payment not found' });

    const group = await Group.findById(settlement.group);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    const memberIds = group.members.map(m => m.toString());
    if (!memberIds.includes(req.user.id))
      return res.status(403).json({ msg: 'You are not a member of this group' });

    // ✅ Revert old linked expenses' settled status before updating
    const oldExpenseIds = settlement.relatedExpenses?.map(e => e.toString()) || [];
    const payerId = settlement.paidBy.toString();
    const payeeId = settlement.paidTo.toString();
    for (const expId of oldExpenseIds) {
      const exp = await Expense.findById(expId);
      if (!exp) continue;
      const expPayerId = exp.paidBy?.toString();
      if (expPayerId === payeeId) {
        await Expense.updateOne({ _id: expId, 'splits.user': payerId }, { $set: { 'splits.$.settled': false } });
      }
      if (expPayerId === payerId) {
        await Expense.updateOne({ _id: expId, 'splits.user': payeeId }, { $set: { 'splits.$.settled': false } });
      }
    }

    settlement.amount = paymentAmount;
    if (note !== undefined) settlement.note = note;

    if (relatedExpenses !== undefined && Array.isArray(relatedExpenses)) {
      settlement.relatedExpenses = await validateRelatedExpenses(
        relatedExpenses, settlement.group, settlement.paidBy, settlement.paidTo
      );
      settlement.relatedExpense = undefined;
    } else if (relatedExpense !== undefined) {
      if (relatedExpense === null) {
        settlement.relatedExpenses = [];
        settlement.relatedExpense  = undefined;
      } else {
        settlement.relatedExpenses = await validateRelatedExpenses(
          [relatedExpense], settlement.group, settlement.paidBy, settlement.paidTo
        );
        settlement.relatedExpense = undefined;
      }
    }
    await settlement.save();

    // ✅ Mark new linked expenses' splits as settled
    const newExpenseIds = settlement.relatedExpenses?.map(e => e.toString()) || [];
    for (const expId of newExpenseIds) {
      const exp = await Expense.findById(expId);
      if (!exp) continue;
      const expPayerId = exp.paidBy?.toString();
      if (expPayerId === payeeId) {
        await Expense.updateOne({ _id: expId, 'splits.user': payerId }, { $set: { 'splits.$.settled': true } });
      }
      if (expPayerId === payerId) {
        await Expense.updateOne({ _id: expId, 'splits.user': payeeId }, { $set: { 'splits.$.settled': true } });
      }
    }

    const populatedSettlement = await settlement.populate([
      { path: 'paidBy',           select: 'name email' },
      { path: 'paidTo',           select: 'name email' },
      { path: 'relatedExpenses',  select: 'description amount' },
    ]);

    await logActivity({
      groupId: settlement.group, userId: req.user.id,
      action: 'updated', type: 'settlement',
      description: `updated a payment to ₹${paymentAmount}`,
      amount: paymentAmount,
    });

    // ✅ Invalidate cache
    await invalidateGroup(settlement.group.toString(), req.user.id);

    res.json(populatedSettlement);
  } catch (err) {
    res.status(err.status || 500).json(err.status ? { msg: err.message } : { error: err.message });
  }
});

// ─── DELETE /api/settlements/:settlementId ────────────────────────────────────
router.delete('/:settlementId', auth, async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.settlementId);
    if (!settlement) return res.status(404).json({ msg: 'Payment not found' });

    const group = await Group.findById(settlement.group);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    const memberIds = group.members.map(m => m.toString());
    if (!memberIds.includes(req.user.id))
      return res.status(403).json({ msg: 'You are not a member of this group' });

    // ✅ Revert settled status on linked expenses before deleting
    const delPayerId = settlement.paidBy.toString();
    const delPayeeId = settlement.paidTo.toString();
    const delExpenseIds = settlement.relatedExpenses?.map(e => e.toString()) || [];
    for (const expId of delExpenseIds) {
      const exp = await Expense.findById(expId);
      if (!exp) continue;
      const expPayerId = exp.paidBy?.toString();
      if (expPayerId === delPayeeId) {
        await Expense.updateOne({ _id: expId, 'splits.user': delPayerId }, { $set: { 'splits.$.settled': false } });
      }
      if (expPayerId === delPayerId) {
        await Expense.updateOne({ _id: expId, 'splits.user': delPayeeId }, { $set: { 'splits.$.settled': false } });
      }
    }

    // ✅ Also revert auto-settled (offset) expenses
    const autoSettledIds = settlement.autoSettledExpenses?.map(e => e.toString()) || [];
    for (const expId of autoSettledIds) {
      await Expense.updateOne(
        { _id: expId, 'splits.user': delPayeeId },
        { $set: { 'splits.$.settled': false } }
      );
    }

    await Settlement.findByIdAndDelete(req.params.settlementId);

    await logActivity({
      groupId: settlement.group, userId: req.user.id,
      action: 'deleted', type: 'settlement',
      description: `deleted a payment of ₹${settlement.amount}`,
      amount: settlement.amount,
    });

    // ✅ Invalidate cache
    await invalidateGroup(settlement.group.toString(), req.user.id);

    res.json({ msg: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
