const sendExpenseNotificationEmail = async (
  emails,
  groupName,
  expenseDescription,
  amount,
  addedBy
) => {
  if (!emails?.length) return;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,   // SMTP key nahi — API key chahiye
      },
      body: JSON.stringify({
        sender: { name: 'Splitwise App', email: process.env.BREVO_SENDER_EMAIL },
        to: emails.map(email => ({ email })),
        subject: `💸 New Expense in ${groupName}`,
        htmlContent: `
          <div style="font-family:Arial">
            <h2>New Expense Added 🚀</h2>
            <p><b>${addedBy}</b> added expense in <b>${groupName}</b></p>
            <p>${expenseDescription}</p>
            <p>Amount: ₹${Number(amount).toFixed(2)}</p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('❌ Brevo API error:', err);
    } else {
      console.log('✅ Email sent via Brevo API');
    }
  } catch (err) {
    console.error('❌ Email error:', err.message);
  }
};

const sendPaymentReminderEmail = async ({
  toEmail,
  toName,
  fromName,
  groupName,
  amount,
}) => {
  if (!toEmail || Number(amount || 0) <= 0) return false;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'Splitwise App', email: process.env.BREVO_SENDER_EMAIL },
        to: [{ email: toEmail, name: toName }],
        subject: `Payment reminder from ${fromName}`,
        htmlContent: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
            <h2>Payment Reminder</h2>
            <p>Hi ${toName || 'there'},</p>
            <p>Please pay <b>${fromName}</b> ₹${Number(amount).toFixed(2)}${groupName ? ` for <b>${groupName}</b>` : ''}.</p>
            <p style="color:#6b7280;font-size:13px">This reminder was sent from Splitwise App.</p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('❌ Brevo reminder API error:', err);
      return false;
    }

    console.log('✅ Payment reminder email sent via Brevo API');
    return true;
  } catch (err) {
    console.error('❌ Reminder email error:', err.message);
    return false;
  }
};

module.exports = { sendExpenseNotificationEmail, sendPaymentReminderEmail };
