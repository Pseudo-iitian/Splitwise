const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  price: {
    type: Number,
    default: 0,
  },
  link: {
    type: String,
    trim: true,
    default: '',
  },
  category: {
    type: String,
    enum: ['electronics', 'food', 'travel', 'clothing', 'home', 'entertainment', 'other'],
    default: 'other',
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // Who has voted/liked this item
  votes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  isBought: {
    type: Boolean,
    default: false,
  },
  boughtBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  boughtAt: {
    type: Date,
    default: null,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
}, { timestamps: true });

module.exports = mongoose.model('WishlistItem', wishlistItemSchema);