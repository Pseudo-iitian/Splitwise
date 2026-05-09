const Group = require('../models/Group');
const User = require('../models/User');
const PaymentReminder = require('../models/PaymentReminder');
const { calculateUserReceivables } = require('./splitHelpers');
const { sendPaymentReminderEmail } = require('./emailService');

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function sendPaymentReminder({ groupId, fromUserId, toUserId }) {
  const [group, fromUser, toUser] = await Promise.all([
    Group.findById(groupId),
    User.findById(fromUserId).select('name email'),
    User.findById(toUserId).select('name email'),
  ]);

  if (!group) {
    const err = new Error('Group not found');
    err.status = 404;
    throw err;
  }
  if (!fromUser || !toUser) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const memberIds = group.members.map(member => member.toString());
  if (!memberIds.includes(fromUserId.toString()) || !memberIds.includes(toUserId.toString())) {
    const err = new Error('Both users must be group members');
    err.status = 400;
    throw err;
  }
  if (fromUserId.toString() === toUserId.toString()) {
    const err = new Error('Cannot send reminder to yourself');
    err.status = 400;
    throw err;
  }

  const receivables = await calculateUserReceivables(groupId, fromUserId);
  const receivable = receivables.find(item => item.memberId === toUserId.toString());
  const amount = +Number(receivable?.amount || 0).toFixed(2);

  if (amount <= 0.009) {
    const err = new Error('No pending amount to remind');
    err.status = 400;
    throw err;
  }

  const existing = await PaymentReminder.findOne({
    group: groupId,
    fromUser: fromUserId,
    toUser: toUserId,
  });
  const now = new Date();

  if (existing && now - existing.lastSentAt < COOLDOWN_MS) {
    const nextAllowedAt = new Date(existing.lastSentAt.getTime() + COOLDOWN_MS);
    const err = new Error('Reminder already sent in the last 24 hours');
    err.status = 429;
    err.nextAllowedAt = nextAllowedAt;
    throw err;
  }

  const sent = await sendPaymentReminderEmail({
    toEmail: toUser.email,
    toName: toUser.name,
    fromName: fromUser.name,
    groupName: group.name,
    amount,
  });

  if (!sent) {
    const err = new Error('Failed to send reminder email');
    err.status = 502;
    throw err;
  }

  await PaymentReminder.findOneAndUpdate(
    { group: groupId, fromUser: fromUserId, toUser: toUserId },
    { amount, lastSentAt: now },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    toUser: { id: toUser._id.toString(), name: toUser.name, email: toUser.email },
    fromUser: { id: fromUser._id.toString(), name: fromUser.name, email: fromUser.email },
    amount,
    sentAt: now,
  };
}

module.exports = { sendPaymentReminder, COOLDOWN_MS };
