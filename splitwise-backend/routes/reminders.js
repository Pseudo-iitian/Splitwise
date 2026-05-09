const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendPaymentReminder } = require('../utils/paymentReminder');
const { sendWeeklyPaymentReminders } = require('../utils/reminderScheduler');

router.post('/groups/:groupId/payment/:memberId', auth, async (req, res) => {
  try {
    const result = await sendPaymentReminder({
      groupId: req.params.groupId,
      fromUserId: req.user.id,
      toUserId: req.params.memberId,
    });

    res.json({ msg: 'Reminder sent', reminder: result });
  } catch (err) {
    const payload = err.nextAllowedAt
      ? { msg: err.message, nextAllowedAt: err.nextAllowedAt }
      : { msg: err.message };
    res.status(err.status || 500).json(payload);
  }
});

router.post('/weekly', async (req, res) => {
  try {
    if (process.env.CRON_SECRET) {
      const token = req.header('x-cron-secret');
      if (token !== process.env.CRON_SECRET) {
        return res.status(401).json({ msg: 'Invalid cron secret' });
      }
    }

    await sendWeeklyPaymentReminders();
    res.json({ msg: 'Weekly reminders processed' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
