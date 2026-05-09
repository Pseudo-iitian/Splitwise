const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar:   String,
  upiId:    { type: String, default: '' },       // e.g. "name@gpay"
  upiVerified: { type: Boolean, default: false }, // verified flag
  upiVerificationStatus: {
    type: String,
    enum: ['none', 'formatOnly', 'verified'],
    default: 'none'
  },
  friends:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);