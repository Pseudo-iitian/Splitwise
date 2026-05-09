const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const { loginSchema } = require('../middleware/validation');

// ─── Register ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user   = new User({ name, email, password: hashed });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message });

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, upiId: user.upiId, upiVerified: user.upiVerified, upiVerificationStatus: user.upiVerificationStatus || (user.upiVerified ? 'verified' : 'none') } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get Me ───────────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Update Profile (name + upiId) ────────────────────────────────────────────
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, upiId } = req.body;
    const updates = {};
    if (name?.trim())  updates.name  = name.trim();
    if (upiId !== undefined) {
      updates.upiId                = upiId.trim();
      updates.upiVerified          = false; // reset verified on change
      updates.upiVerificationStatus = 'none';
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).select('-password');

    res.json({ user: { id: user._id, name: user.name, email: user.email, upiId: user.upiId, upiVerified: user.upiVerified, upiVerificationStatus: user.upiVerificationStatus || (user.upiVerified ? 'verified' : 'none') } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Verify UPI ID ─────────────────────────────────────────────────────────────
// UPI verification: format validation only.
// Real bank-level verification requires an external UPI/payment provider.
router.post('/verify-upi', auth, async (req, res) => {
  try {
    const { upiId } = req.body;
    if (!upiId?.trim()) return res.status(400).json({ error: 'UPI ID required' });

    const normalizedUpiId = upiId.trim().toLowerCase();

    // ── UPI format validation ─────────────────────────────────────────────────
    // Valid formats include: name@bank, number@gpay, number@paytm, name@upi, etc.
    const upiRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9.\-_]{0,255})@[a-zA-Z0-9](?:[a-zA-Z0-9.\-_]{0,63})$/;
    if (!upiRegex.test(normalizedUpiId)) {
      return res.status(400).json({ error: 'Invalid UPI ID format. Example: name@gpay or 9876543210@paytm' });
    }

    // ── Keep verification safe until a real provider integration exists ───────
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          upiId: normalizedUpiId,
          upiVerified: false,
          upiVerificationStatus: 'formatOnly'
        }
      },
      { new: true }
    ).select('-password');

    res.json({
      verified: false,
      formatValid: true,
      message: 'UPI format is valid. Full verification requires payment provider integration.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        upiId: user.upiId,
        upiVerified: user.upiVerified,
        upiVerificationStatus: user.upiVerificationStatus
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;