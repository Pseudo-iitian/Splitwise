const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',   // IPv4 only — Render pe works
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_EMAIL,   // Brevo login email
    pass: process.env.BREVO_SMTP_KEY, // Brevo SMTP key (API key nahi)
  },
});

const sendExpenseNotificationEmail = async (
  emails,
  groupName,
  expenseDescription,
  amount,
  addedBy
) => {
  if (!emails?.length) return;

  try {
    await transporter.sendMail({
      from: `"Splitwise App" <${process.env.BREVO_EMAIL}>`,
      to: emails.join(','),
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

    console.log('✅ Email sent via Brevo');
  } catch (err) {
    console.error('❌ Email error:', err.message);
  }
};

module.exports = { sendExpenseNotificationEmail };