const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'created', 'updated', 'deleted', 'paid', 'marked_paid'
  type: { type: String, required: true }, // e.g., 'expense', 'settlement', 'group'
  description: { type: String, required: true }, // The human readable summary of what happened
  amount: { type: Number }, // Optional amount involved
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
