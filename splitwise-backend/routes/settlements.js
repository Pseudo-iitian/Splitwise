const express    = require('express');
const router     = express.Router();
const Settlement = require('../models/Settlement');
const Group      = require('../models/Group');
const Expense    = require('../models/Expense');
const auth       = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

async function validateRelatedExpenses(relatedExpenses, groupId, payerId, payeeId) {
  if (!relatedExpenses || !Array.isArray(relatedExpenses) || relatedExpenses.length === 0) return [];

  const validExpenseIds = [];
  for (const expenseId of relatedExpenses) {
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      const err = new Error(`Related expense ${expenseId} not found`);
      err.status = 404;
      throw err;
    }
    if (expense.group.toString() !== groupId.toString()) {
      const err = new Error('Related expense must belong to the same group');
      err.status = 400;
      throw err;
    }
    if (expense.paidBy.toString() !== payeeId.toString()) {
      const err = new Error('Related expense must be paid by the receiver');
      err.status = 400;
      throw err;
    }
    const payerInSplit = expense.splits.some(split => split.user.toString() === payerId.toString());
    if (!payerInSplit) {
      const err = new Error('Payer must be included in the related expense split');
      err.status = 400;
      throw err;
    }
    validExpenseIds.push(expense._id);
  }

  return validExpenseIds;
}

router.post('/', auth, async (req, res) => {
  try {
    const { groupId, paidBy, paidTo, amount, note, relatedExpense, relatedExpenses, isExpenseUpdate } = req.body;
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

    let expenseIds = [];
    if (relatedExpenses && Array.isArray(relatedExpenses)) {
      expenseIds = await validateRelatedExpenses(relatedExpenses, groupId, payerId, paidTo);
    } else if (relatedExpense) {
      expenseIds = await validateRelatedExpenses([relatedExpense], groupId, payerId, paidTo);
    }

    const settlement = new Settlement({
      group: groupId,
      paidBy: payerId,
      paidTo,
      amount: paymentAmount,
      relatedExpenses: expenseIds,
      isExpenseUpdate: isExpenseUpdate || false,
      note
    });
    await settlement.save();

    const populatedSettlement = await settlement.populate([
      { path: 'paidBy', select: 'name email' },
      { path: 'paidTo', select: 'name email' },
      { path: 'relatedExpenses', select: 'description amount' }
    ]);

    await logActivity({
      groupId,
      userId: req.user.id,
      action: isExpenseUpdate ? 'marked_paid' : 'paid',
      type: 'settlement',
      description: isExpenseUpdate 
        ? `marked a split as paid`
        : `paid ₹${paymentAmount} to ${populatedSettlement.paidTo.name}`,
      amount: paymentAmount
    });

    res.status(201).json(populatedSettlement);
  } catch (err) {
    res.status(err.status || 500).json(err.status ? { msg: err.message } : { error: err.message });
  }
});

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const settlements = await Settlement.find({ group: req.params.groupId })
      .populate('paidBy', 'name email')
      .populate('paidTo', 'name email')
      .populate('relatedExpense', 'description amount')
      .populate('relatedExpenses', 'description amount')
      .sort({ date: -1 });
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:settlementId', auth, async (req, res) => {
  try {
    const { amount, note, relatedExpense, relatedExpenses } = req.body;
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
    
    if (relatedExpenses !== undefined && Array.isArray(relatedExpenses)) {
      settlement.relatedExpenses = await validateRelatedExpenses(
        relatedExpenses,
        settlement.group,
        settlement.paidBy,
        settlement.paidTo
      );
      settlement.relatedExpense = undefined;
    } else if (relatedExpense !== undefined) {
      if (relatedExpense === null) {
        settlement.relatedExpenses = [];
        settlement.relatedExpense = undefined;
      } else {
        settlement.relatedExpenses = await validateRelatedExpenses(
          [relatedExpense],
          settlement.group,
          settlement.paidBy,
          settlement.paidTo
        );
        settlement.relatedExpense = undefined;
      }
    }
    await settlement.save();

    const populatedSettlement = await settlement.populate([
      { path: 'paidBy', select: 'name email' },
      { path: 'paidTo', select: 'name email' },
      { path: 'relatedExpenses', select: 'description amount' }
    ]);

    await logActivity({
      groupId: settlement.group,
      userId: req.user.id,
      action: 'updated',
      type: 'settlement',
      description: `updated a payment to ₹${paymentAmount}`,
      amount: paymentAmount
    });

    res.json(populatedSettlement);
  } catch (err) {
    res.status(err.status || 500).json(err.status ? { msg: err.message } : { error: err.message });
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

    await logActivity({
      groupId: settlement.group,
      userId: req.user.id,
      action: 'deleted',
      type: 'settlement',
      description: `deleted a payment of ₹${settlement.amount}`,
      amount: settlement.amount
    });

    res.json({ msg: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
