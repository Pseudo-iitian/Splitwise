const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: String,
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  category:    { 
    type: String, 
    enum: ['trip', 'home', 'food', 'shopping', 'entertainment', 'other'], 
    default: 'other' 
  },

  // ✅ ADD THIS
  inviteToken: {
    type: String,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);