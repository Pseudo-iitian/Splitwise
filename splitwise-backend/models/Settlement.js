const mongoose = require('mongoose');
const settlementSchema = new mongoose.Schema({
  group:  { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  paidTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  amount: { type: Number, required: true },
  relatedExpense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
  relatedExpenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }],
  // Expenses auto-settled due to net-settlement offset (e.g. Sahil's grocery splits when Abhishek pays net)
  autoSettledExpenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }],
  isExpenseUpdate: { type: Boolean, default: false },
  note:   { type: String, default: '' },
  date:   { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.model('Settlement', settlementSchema);
