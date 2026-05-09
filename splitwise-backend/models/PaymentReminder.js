const mongoose = require('mongoose');

const paymentReminderSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  lastSentAt: { type: Date, required: true },
}, { timestamps: true });

paymentReminderSchema.index({ group: 1, fromUser: 1, toUser: 1 }, { unique: true });

module.exports = mongoose.model('PaymentReminder', paymentReminderSchema);
