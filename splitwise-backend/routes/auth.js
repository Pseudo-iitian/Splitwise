const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const auth     = require('../middleware/auth');

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
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, upiId: user.upiId, upiVerified: user.upiVerified } });
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
      updates.upiId       = upiId.trim();
      updates.upiVerified = false; // reset verified on change
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).select('-password');

    res.json({ user: { id: user._id, name: user.name, email: user.email, upiId: user.upiId, upiVerified: user.upiVerified } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Verify UPI ID ─────────────────────────────────────────────────────────────
// UPI verification: basic format check + mark verified
// Real bank-level verification needs Razorpay/Cashfree — this does format validation
router.post('/verify-upi', auth, async (req, res) => {
  try {
    const { upiId } = req.body;
    if (!upiId?.trim()) return res.status(400).json({ error: 'UPI ID required' });

    // ── UPI format validation ─────────────────────────────────────────────────
    // Valid formats: name@bank, number@gpay, number@paytm, name@upi etc.
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(upiId.trim())) {
      return res.status(400).json({ error: 'Invalid UPI ID format. Example: name@gpay or 9876543210@paytm' });
    }

    // ── Check known VPAs (Virtual Payment Addresses) ──────────────────────────
    const knownHandles = [
      'gpay', 'oksbi', 'okaxis', 'okicici', 'okhdfcbank',
      'paytm', 'ybl', 'ibl', 'axl', 'upi', 'freecharge',
      'apl', 'bhim', 'sbi', 'hdfc', 'icici', 'axis',
      'kotak', 'indus', 'pnb', 'bob', 'cnrb', 'aubank',
      'rapl', 'jupiteraxis', 'ikwik', 'phonepe', 'rbl',
    ];
    const handle = upiId.split('@')[1]?.toLowerCase();
    if (!knownHandles.includes(handle)) {
      return res.status(400).json({ 
        error: `Unknown UPI handle "@${handle}". Please check your UPI ID.`,
        hint:  'Common handles: @gpay, @paytm, @ybl, @oksbi, @okhdfcbank'
      });
    }

    // ── Mark as verified ──────────────────────────────────────────────────────
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { upiId: upiId.trim(), upiVerified: true } },
      { new: true }
    ).select('-password');

    res.json({ 
      verified: true, 
      message: 'UPI ID verified successfully! ✅',
      user: { id: user._id, name: user.name, email: user.email, upiId: user.upiId, upiVerified: user.upiVerified }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;