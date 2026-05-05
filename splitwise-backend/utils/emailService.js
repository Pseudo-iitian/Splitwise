// emailService.js - Free email using Nodemailer + Gmail
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,      // your Gmail
    pass: process.env.EMAIL_PASS,  // Gmail App Password (NOT your real password)
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
      from: `"Splitwise App" <${process.env.EMAIL_USER}>`,
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

    console.log('✅ Email sent via Gmail');
  } catch (err) {
    console.error('❌ Email error:', err.message);
  }
};

module.exports = { sendExpenseNotificationEmail };