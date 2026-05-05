const nodemailer = require('nodemailer');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

// ✅ Improved transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  connectionTimeout: 10000, // ⏱️ important
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

/**
 * Send email
 */
const sendExpenseNotificationEmail = async (
  emails,
  groupName,
  expenseDescription,
  amount,
  addedBy
) => {

  if (!emails?.length) return;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email env missing');
    return;
  }

  const mailOptions = {
    from: `"Splitwise Clone" <${process.env.EMAIL_USER}>`,
    to: emails.join(','),
    subject: `💸 New Expense in ${groupName}`,
    html: `
      <h2>New Expense Added</h2>
      <p><b>${addedBy}</b> added in <b>${groupName}</b></p>
      <p>${expenseDescription}</p>
      <p>₹${Number(amount).toFixed(2)}</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.response);
  } catch (error) {
    // ❗ IMPORTANT: don't break API
    console.error('❌ Email error:', error.message);
  }
};

module.exports = { sendExpenseNotificationEmail };