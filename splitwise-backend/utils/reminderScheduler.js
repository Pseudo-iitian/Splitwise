const Group = require('../models/Group');
const { calculateUserReceivables } = require('./splitHelpers');
const { sendPaymentReminder } = require('./paymentReminder');

let schedulerStarted = false;
let lastRunKey = null;

function getIstRunKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    key: `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}`,
    weekday: parts.weekday,
    hour: parts.hour,
    minute: parts.minute,
  };
}

async function sendWeeklyPaymentReminders() {
  const groups = await Group.find({}).populate('members', 'name email');

  for (const group of groups) {
    for (const member of group.members || []) {
      const receivables = await calculateUserReceivables(group._id, member._id);
      const pendingRows = receivables.filter(item => Number(item.amount || 0) > 0.009);

      for (const row of pendingRows) {
        try {
          await sendPaymentReminder({
            groupId: group._id,
            fromUserId: member._id,
            toUserId: row.memberId,
          });
        } catch (err) {
          if (err.status !== 429) {
            console.error('Weekly payment reminder failed:', {
              groupId: group._id.toString(),
              fromUserId: member._id.toString(),
              toUserId: row.memberId,
              error: err.message,
            });
          }
        }
      }
    }
  }
}

function startReminderScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setInterval(async () => {
    const run = getIstRunKey();
    if (run.weekday !== 'Sun' || run.hour !== '09' || run.minute !== '00') return;
    if (lastRunKey === run.key) return;

    lastRunKey = run.key;
    try {
      await sendWeeklyPaymentReminders();
      console.log('✅ Weekly payment reminders completed');
    } catch (err) {
      console.error('❌ Weekly payment reminders failed:', err.message);
    }
  }, 60 * 1000);
}

module.exports = { startReminderScheduler, sendWeeklyPaymentReminders };
