const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Settlement = require('../models/Settlement');
const Group = require('../models/Group');
const { logActivity } = require('../utils/activityLogger');
const { invalidateGroup } = require('../utils/cache');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── POST /api/payments/create-order ──────────────────────────────────────────
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount, groupId, paidTo, relatedExpenses } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: 'Valid amount required' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise mein
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        groupId,
        paidBy: req.user.id,
        paidTo,
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/payments/verify ─────────────────────────────────────────────────
router.post('/verify', auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      groupId,
      paidTo,
      amount,
      relatedExpenses,
    } = req.body;

    // ✅ Signature verify karo
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ msg: 'Payment verification failed' });
    }

    // ✅ Settlement record karo automatically
    const settlement = new Settlement({
      group: groupId,
      paidBy: req.user.id,
      paidTo,
      amount: parseFloat(amount),
      relatedExpenses: relatedExpenses || [],
      note: `Paid via Razorpay | Payment ID: ${razorpay_payment_id}`,
      paymentMethod: 'razorpay',
      razorpayPaymentId: razorpay_payment_id,
    });
    await settlement.save();

    const populated = await settlement.populate([
      { path: 'paidBy', select: 'name email' },
      { path: 'paidTo', select: 'name email' },
    ]);

    await logActivity({
      groupId,
      userId: req.user.id,
      action: 'paid',
      type: 'settlement',
      description: `paid ₹${amount} via Razorpay to ${populated.paidTo.name}`,
      amount: parseFloat(amount),
    });

    await invalidateGroup(groupId, req.user.id);

    res.json({ msg: 'Payment verified!', settlement: populated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;