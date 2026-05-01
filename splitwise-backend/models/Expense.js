const mongoose = require('mongoose');
const expenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount:      { type: Number, required: true },
  paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group:       { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  splitType:   { type: String, enum: ['equal', 'percentage', 'exact'], default: 'equal' },
  splits: [{
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount:   Number,
    settled:  { type: Boolean, default: false }
  }],
  date: { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.model('Expense', expenseSchema);
