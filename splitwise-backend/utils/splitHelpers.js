const Expense = require('../models/Expense');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement');

function splitEqually(amount, members) {
  const share = +(amount / members.length).toFixed(2);
  return members.map(userId => ({ user: userId, amount: share }));
}

function splitByPercentage(amount, splits) {
  return splits.map(s => ({
    user: s.user,
    amount: +((amount * s.percentage) / 100).toFixed(2)
  }));
}

function splitByExact(splits) {
  return splits.map(s => ({ user: s.user, amount: s.amount }));
}

async function calculateBalances(groupId) {
  const expenses = await Expense.find({ group: groupId })
    .populate('splits.user paidBy');
  const settlements = await Settlement.find({ group: groupId });
  const balances = {};
  expenses.forEach(exp => {
    const paidById = exp.paidBy._id.toString();
    balances[paidById] = (balances[paidById] || 0) + exp.amount;
    exp.splits.forEach(split => {
      const uid = split.user._id.toString();
      balances[uid] = (balances[uid] || 0) - split.amount;
    });
  });
  settlements.forEach(settlement => {
    const payerId = settlement.paidBy.toString();
    const payeeId = settlement.paidTo.toString();
    balances[payerId] = +((balances[payerId] || 0) + settlement.amount).toFixed(2);
    balances[payeeId] = +((balances[payeeId] || 0) - settlement.amount).toFixed(2);
  });
  return balances;
}

async function calculateDetailedBalances(groupId) {
  const group = await Group.findById(groupId).populate('members', 'name email');
  const expenses    = await Expense.find({ group: groupId }).populate('splits.user paidBy');
  const settlements = await Settlement.find({ group: groupId }).populate('paidBy paidTo');

  const balances = {}; // { userId: { amount, name, email } }

  const ensureUser = (id, name, email) => {
    if (!id) return;
    if (!balances[id]) balances[id] = { amount: 0, name, email };
  };

  group?.members?.forEach(member => {
    ensureUser(member._id.toString(), member.name, member.email);
  });

  const addAmount = (id, name, email, amount) => {
    ensureUser(id, name, email);
    balances[id].amount = +(balances[id].amount + amount).toFixed(2);
  };

  expenses.forEach(exp => {
    const paidById   = exp.paidBy._id.toString();
    const paidByName = exp.paidBy.name;
    const paidByEmail = exp.paidBy.email;
    addAmount(paidById, paidByName, paidByEmail, exp.amount);

    exp.splits.forEach(split => {
      const uid   = split.user._id.toString();
      const uname = split.user.name;
      const uemail = split.user.email;
      addAmount(uid, uname, uemail, -split.amount);
    });
  });

  settlements.forEach(s => {
    const payerId   = s.paidBy._id.toString();
    const payeeId   = s.paidTo._id.toString();
    addAmount(payerId, s.paidBy.name, s.paidBy.email, s.amount);
    addAmount(payeeId, s.paidTo.name, s.paidTo.email, -s.amount);
  });

  return balances;
}

function simplifyBalances(balances) {
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([id, data]) => {
    const amount = +data.amount.toFixed(2);
    if (amount < -0.009) debtors.push({ id, ...data, remaining: Math.abs(amount) });
    if (amount > 0.009) creditors.push({ id, ...data, remaining: amount });
  });

  debtors.sort((a, b) => b.remaining - a.remaining);
  creditors.sort((a, b) => b.remaining - a.remaining);

  const suggestions = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = +Math.min(debtor.remaining, creditor.remaining).toFixed(2);

    if (amount > 0.009) {
      suggestions.push({
        paidBy: {
          id: debtor.id,
          name: debtor.name,
          email: debtor.email
        },
        paidTo: {
          id: creditor.id,
          name: creditor.name,
          email: creditor.email
        },
        amount
      });
    }

    debtor.remaining = +(debtor.remaining - amount).toFixed(2);
    creditor.remaining = +(creditor.remaining - amount).toFixed(2);

    if (debtor.remaining <= 0.009) debtorIndex += 1;
    if (creditor.remaining <= 0.009) creditorIndex += 1;
  }

  return suggestions;
}

async function calculateUserDebts(groupId, userId) {
  const expenses = await Expense.find({ group: groupId })
    .populate('paidBy', 'name email')
    .populate('splits.user', 'name email');
  const settlements = await Settlement.find({ group: groupId })
    .populate('paidBy', 'name email')
    .populate('paidTo', 'name email')
    .populate('relatedExpense', 'description amount');

  const debts = {};
  const linkedPayments = {};
  const currentUserId = userId.toString();

  const ensureDebt = person => {
    const id = person._id.toString();
    if (!debts[id]) {
      debts[id] = {
        id,
        name: person.name,
        email: person.email,
        amount: 0
      };
    }
    return debts[id];
  };

  const addDebt = (person, amount) => {
    const debt = ensureDebt(person);
    debt.amount = +(debt.amount + amount).toFixed(2);
  };

  settlements.forEach(settlement => {
    const payerId = settlement.paidBy._id.toString();
    if (payerId === currentUserId && settlement.relatedExpense?._id) {
      const expenseId = settlement.relatedExpense._id.toString();
      linkedPayments[expenseId] = +((linkedPayments[expenseId] || 0) + settlement.amount).toFixed(2);
    }
  });

  expenses.forEach(expense => {
    const paidById = expense.paidBy._id.toString();

    if (paidById === currentUserId) {
      expense.splits.forEach(split => {
        const splitUserId = split.user?._id?.toString() || split.user?.toString();
        if (splitUserId && splitUserId !== currentUserId) {
          addDebt(split.user, -split.amount);
        }
      });
      return;
    }

    const userSplit = expense.splits.find(split => {
      const splitUserId = split.user?._id?.toString() || split.user?.toString();
      return splitUserId === currentUserId;
    });
    if (userSplit) {
      addDebt(expense.paidBy, userSplit.amount);

      const debt = ensureDebt(expense.paidBy);
      const expenseId = expense._id.toString();
      const remainingAmount = +(userSplit.amount - (linkedPayments[expenseId] || 0)).toFixed(2);
      if (remainingAmount > 0.009) {
        debt.expenses = debt.expenses || [];
        debt.expenses.push({
          id: expenseId,
          description: expense.description,
          amount: expense.amount,
          userShare: userSplit.amount,
          remainingAmount
        });
      }
    }
  });

  settlements.forEach(settlement => {
    const payerId = settlement.paidBy._id.toString();
    const payeeId = settlement.paidTo._id.toString();

    if (payerId === currentUserId) addDebt(settlement.paidTo, -settlement.amount);
    if (payeeId === currentUserId) addDebt(settlement.paidBy, settlement.amount);
  });

  return Object.values(debts)
    .filter(debt => debt.amount > 0.009)
    .map(debt => ({
      ...debt,
      expenses: (debt.expenses || []).sort((a, b) => b.remainingAmount - a.remainingAmount)
    }))
    .sort((a, b) => b.amount - a.amount);
}

async function calculateSettlementSummary(groupId, userId) {
  const balances = await calculateDetailedBalances(groupId);
  const settlements = await Settlement.find({ group: groupId })
    .populate('paidBy', 'name email')
    .populate('paidTo', 'name email')
    .populate('relatedExpense', 'description amount')
    .sort({ date: -1 });

  return {
    balances,
    members: Object.entries(balances).map(([id, data]) => ({ id, ...data })),
    suggestions: simplifyBalances(balances),
    userDebts: userId ? await calculateUserDebts(groupId, userId) : [],
    settlements
  };
}

module.exports = {
  splitEqually,
  splitByPercentage,
  splitByExact,
  calculateBalances,
  calculateDetailedBalances,
  calculateUserDebts,
  calculateSettlementSummary
};
