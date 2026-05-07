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

module.exports = { sendExpenseNotificationEmail };