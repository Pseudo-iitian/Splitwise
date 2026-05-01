const Expense = require('../models/Expense');

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
  const balances = {};
  expenses.forEach(exp => {
    const paidById = exp.paidBy._id.toString();
    balances[paidById] = (balances[paidById] || 0) + exp.amount;
    exp.splits.forEach(split => {
      const uid = split.user._id.toString();
      balances[uid] = (balances[uid] || 0) - split.amount;
    });
  });
  return balances;
}

module.exports = { splitEqually, splitByPercentage, splitByExact, calculateBalances };
