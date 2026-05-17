const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require('../middleware/validation');
const { sendPasswordResetEmail } = require('../utils/emailService');

// ─── Register ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email?.trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ msg: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user   = new User({ name, email: normalizedEmail, password: hashed });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email: user.email } });
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
    const normalizedEmail = email.trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, upiId: user.upiId, upiVerified: user.upiVerified, upiVerificationStatus: user.upiVerificationStatus || (user.upiVerified ? 'verified' : 'none') } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { error } = forgotPasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message });

    const normalizedEmail = req.body.email.trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 5 * 60 * 1000);
      await user.save({ validateBeforeSave: false });

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const resetLink = `${frontendUrl}/login?mode=reset&token=${resetToken}`;
      await sendPasswordResetEmail({
        toEmail: user.email,
        toName: user.name,
        resetLink
      });
    }

    res.json({
      msg: 'If an account exists for this email, a password reset link has been sent.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Reset Password ───────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { error } = resetPasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ msg: error.details[0].message });

    const hashedToken = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ msg: 'This reset link is invalid or has expired.' });
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({ msg: 'Password reset successful. Please sign in.' });
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
