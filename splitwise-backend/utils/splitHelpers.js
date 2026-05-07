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
    .populate('splits.user paidBy')
    .populate('paidByMultiple.user');
  const settlements = await Settlement.find({ group: groupId });
  const balances = {};
  expenses.forEach(exp => {
    if (exp.paidByMultiple && exp.paidByMultiple.length > 0) {
      exp.paidByMultiple.forEach(payer => {
        const pId = payer.user._id ? payer.user._id.toString() : payer.user.toString();
        balances[pId] = (balances[pId] || 0) + payer.amount;
      });
    } else if (exp.paidBy) {
      const paidById = exp.paidBy._id ? exp.paidBy._id.toString() : exp.paidBy.toString();
      balances[paidById] = (balances[paidById] || 0) + exp.amount;
    }
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
  const expenses    = await Expense.find({ group: groupId }).populate('splits.user paidBy paidByMultiple.user');
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
    if (exp.paidByMultiple && exp.paidByMultiple.length > 0) {
      exp.paidByMultiple.forEach(payer => {
        if (!payer.user) return;
        const pId = payer.user._id ? payer.user._id.toString() : payer.user.toString();
        addAmount(pId, payer.user.name, payer.user.email, payer.amount);
      });
    } else if (exp.paidBy) {
      const paidById   = exp.paidBy._id.toString();
      const paidByName = exp.paidBy.name;
      const paidByEmail = exp.paidBy.email;
      addAmount(paidById, paidByName, paidByEmail, exp.amount);
    }

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
    .populate('paidByMultiple.user', 'name email')
    .populate('splits.user', 'name email');
    
  const settlements = await Settlement.find({ group: groupId })
  .populate('paidBy', 'name email')
  .populate('paidTo', 'name email')
  .populate('relatedExpense',  'description amount splits paidBy')  // ✅
  .populate('relatedExpenses', 'description amount splits paidBy')  // ✅
  .sort({ date: -1 });

  const debts = {};
  const linkedPayments = {};        // current user ne jo pay kiya (expenses jisme wo debtor tha)
  const linkedPaymentsFromOthers = {}; // doosron ne jo pay kiya (expenses jisme current user payer tha)
  const currentUserId = userId.toString();

  const ensureDebt = person => {
    const id = person._id.toString();
    if (!debts[id]) {
      debts[id] = {
        id,
        name: person.name,
        email: person.email,
        amount: 0,
        expenses: [],        // current user owes them ke liye
        creditsFromThem: [], // ✅ they owe current user ke liye (new)
      };
    }
    return debts[id];
  };

  const addDebt = (person, amount) => {
    const debt = ensureDebt(person);
    debt.amount = +(debt.amount + amount).toFixed(2);
  };

  // Settlements track karo
  settlements.forEach(settlement => {
    const payerId = settlement.paidBy._id.toString();
    const payeeId = settlement.paidTo._id.toString();

    if (payerId === currentUserId) {
      // Current user ne payment ki — expenses jisme wo debtor tha
      if (settlement.relatedExpenses?.length > 0) {
        let remainingAmount = settlement.amount;
        settlement.relatedExpenses.forEach(exp => {
          const expenseId = exp._id.toString();
          const expenseObj = expenses.find(e => e._id.toString() === expenseId);
          if (expenseObj) {
            const split = expenseObj.splits.find(s => {
              const splitUserId = s.user?._id?.toString() || s.user?.toString();
              return splitUserId === currentUserId;
            });
            if (split && remainingAmount > 0) {
              const amountToAllocate = Math.min(split.amount, remainingAmount);
              linkedPayments[expenseId] = +((linkedPayments[expenseId] || 0) + amountToAllocate).toFixed(2);
              remainingAmount -= amountToAllocate;
            }
          }
        });
      } else if (settlement.relatedExpense?._id) {
        const expenseId = settlement.relatedExpense._id.toString();
        linkedPayments[expenseId] = +((linkedPayments[expenseId] || 0) + settlement.amount).toFixed(2);
      }
    } else if (payeeId === currentUserId) {
      // Doosre person ne current user ko pay kiya — expenses jisme current user payer tha
      // In amounts ko creditsFromThem se deduct karna hoga
      if (settlement.relatedExpenses?.length > 0) {
        let remainingAmount = settlement.amount;
        settlement.relatedExpenses.forEach(exp => {
          const expenseId = exp._id.toString();
          const expenseObj = expenses.find(e => e._id.toString() === expenseId);
          if (expenseObj) {
            const split = expenseObj.splits.find(s => {
              const splitUserId = s.user?._id?.toString() || s.user?.toString();
              return splitUserId === payerId;
            });
            if (split && remainingAmount > 0) {
              const amountToAllocate = Math.min(split.amount, remainingAmount);
              if (!linkedPaymentsFromOthers[expenseId]) linkedPaymentsFromOthers[expenseId] = {};
              linkedPaymentsFromOthers[expenseId][payerId] = +((linkedPaymentsFromOthers[expenseId][payerId] || 0) + amountToAllocate).toFixed(2);
              remainingAmount -= amountToAllocate;
            }
          }
        });
      } else if (settlement.relatedExpense?._id) {
        const expenseId = settlement.relatedExpense._id.toString();
        if (!linkedPaymentsFromOthers[expenseId]) linkedPaymentsFromOthers[expenseId] = {};
        linkedPaymentsFromOthers[expenseId][payerId] = +((linkedPaymentsFromOthers[expenseId][payerId] || 0) + settlement.amount).toFixed(2);
      }
    }
  });

  expenses.forEach(expense => {
    let currentUserPaidAmount = 0;

    if (expense.paidByMultiple?.length > 0) {
      const p = expense.paidByMultiple.find(payer => payer.user?._id.toString() === currentUserId);
      if (p) currentUserPaidAmount = p.amount;
    } else if (expense.paidBy?._id.toString() === currentUserId) {
      currentUserPaidAmount = expense.amount;
    }

    const userSplit = expense.splits.find(s => {
      const sid = s.user?._id?.toString() || s.user?.toString();
      return sid === currentUserId;
    });
    const currentUserSplitAmount = userSplit ? userSplit.amount : 0;
    const netAmount = currentUserPaidAmount - currentUserSplitAmount;

    if (netAmount > 0) {
      // Current user ne pay kiya — doosron ko unka share dena hai
      expense.splits.forEach(split => {
        const splitUserId = split.user?._id?.toString() || split.user?.toString();
        if (splitUserId && splitUserId !== currentUserId) {
          const ratio = currentUserPaidAmount / expense.amount;
          addDebt(split.user, -split.amount * ratio);

          // ✅ creditsFromThem mein add karo — but settled amounts filter karo
          const expenseId = expense._id.toString();
          const settledByThem = (linkedPaymentsFromOthers[expenseId]?.[splitUserId] || 0);
          const rawShare = +(split.amount * ratio).toFixed(2);
          const remainingCredit = +(rawShare - settledByThem).toFixed(2);
          if (remainingCredit > 0.009) {
            const debt = ensureDebt(split.user);
            debt.creditsFromThem.push({
              id: expenseId,
              description: expense.description,
              amount: expense.amount,
              theirShare: remainingCredit,
            });
          }
        }
      });
    } else if (netAmount < 0) {
      const amountOwed = Math.abs(netAmount);

      if (expense.paidByMultiple?.length > 0) {
        expense.paidByMultiple.forEach(payer => {
          if (payer.user?._id.toString() !== currentUserId) {
            const ratio = payer.amount / expense.amount;
            addDebt(payer.user, amountOwed * ratio);
            if (payer.user._id.toString() === expense.paidByMultiple[0].user._id.toString()) {
              const debt = ensureDebt(payer.user);
              const expenseId = expense._id.toString();
              const remainingAmount = +(amountOwed * ratio - (linkedPayments[expenseId] || 0)).toFixed(2);
              if (remainingAmount > 0.009) {
                debt.expenses.push({
                  id: expenseId,
                  description: expense.description,
                  amount: expense.amount,
                  userShare: amountOwed * ratio,
                  remainingAmount,
                });
              }
            }
          }
        });
      } else if (expense.paidBy) {
        addDebt(expense.paidBy, amountOwed);
        const debt = ensureDebt(expense.paidBy);
        const expenseId = expense._id.toString();
        const remainingAmount = +(amountOwed - (linkedPayments[expenseId] || 0)).toFixed(2);
        if (remainingAmount > 0.009) {
          debt.expenses.push({
            id: expenseId,
            description: expense.description,
            amount: expense.amount,
            userShare: amountOwed,
            remainingAmount,
          });
        }
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
      expenses: (debt.expenses || []).sort((a, b) => b.remainingAmount - a.remainingAmount),
      creditsFromThem: (debt.creditsFromThem || []).sort((a, b) => b.theirShare - a.theirShare), // ✅
    }))
    .sort((a, b) => b.amount - a.amount);
}

async function calculateSettlementSummary(groupId, userId) {
  const balances = await calculateDetailedBalances(groupId);
  const settlements = await Settlement.find({ group: groupId })
    .populate('paidBy', 'name email')
    .populate('paidTo', 'name email')
    .populate('relatedExpense', 'description amount')
    .populate('relatedExpenses', 'description amount')
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
