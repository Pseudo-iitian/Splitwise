const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema({
  text:  { type: String, required: true, trim: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: true });

const chatMessageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // For text messages
  message: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  // Message type
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'audio', 'poll', 'system'],
    default: 'text',
  },
  // For media / file messages
  fileUrl:  { type: String, default: null },
  fileName: { type: String, default: null },  // original filename
  fileSize: { type: Number, default: null },  // bytes
  mimeType: { type: String, default: null },

  // For poll messages
  poll: {
    question: { type: String, trim: true },
    options:  [pollOptionSchema],
    isAnonymous: { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);