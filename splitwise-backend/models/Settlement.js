const mongoose = require('mongoose');
const settlementSchema = new mongoose.Schema({
  group:  { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  paidTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  amount: { type: Number, required: true },
  note:   { type: String, default: '' },
  date:   { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.model('Settlement', settlementSchema);
