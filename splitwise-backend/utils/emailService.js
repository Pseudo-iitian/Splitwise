const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendExpenseNotificationEmail = async (
  emails,
  groupName,
  expenseDescription,
  amount,
  addedBy
) => {
  if (!emails?.length) return;

  try {
    await resend.emails.send({
      from: 'Splitwise <onboarding@resend.dev>', // dev sender
      to: emails,
      subject: `💸 New Expense in ${groupName}`,
      html: `
        <div style="font-family:Arial">
          <h2>New Expense Added 🚀</h2>
          <p><b>${addedBy}</b> added expense in <b>${groupName}</b></p>
          <p>${expenseDescription}</p>
          <p>Amount: ₹${Number(amount).toFixed(2)}</p>
        </div>
      `
    });

    console.log('✅ Email sent via Resend');
  } catch (err) {
    console.error('❌ Email error:', err.message);
  }
};

module.exports = { sendExpenseNotificationEmail };