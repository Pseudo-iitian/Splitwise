const nodemailer = require('nodemailer');
const dns = require('dns');

// 🔥 Force IPv4 (fix ENETUNREACH issue)
dns.setDefaultResultOrder('ipv4first');

// 🔥 Create transporter (FIXED CONFIG)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,          // ✅ use 587 instead of 465
  secure: false,      // ✅ false for TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email notification when a new expense is added
 */
const sendExpenseNotificationEmail = async (
  emails,
  groupName,
  expenseDescription,
  amount,
  addedBy
) => {

  if (!emails || emails.length === 0) return;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('EMAIL_USER or EMAIL_PASS not set. Skipping email.');
    return;
  }

  const mailOptions = {
    from: `"Splitwise Clone" <${process.env.EMAIL_USER}>`,
    to: emails.join(','), // safer than array in some SMTP cases
    subject: `💸 New Expense in ${groupName}`,
    html: `
      <div style="font-family: Arial; max-width:600px; margin:auto; padding:20px; border:1px solid #eee; border-radius:10px;">
        
        <h2 style="color:#333;">New Expense Added 🚀</h2>

        <p style="font-size:16px;">
          <strong>${addedBy}</strong> added an expense in 
          <strong>${groupName}</strong>
        </p>

        <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin:20px 0;">
          <p><strong>Description:</strong> ${expenseDescription}</p>
          <p><strong>Amount:</strong> ₹${Number(amount).toFixed(2)}</p>
        </div>

        <p style="font-size:14px; color:#777;">
          Open the app to check balances and settle up.
        </p>

      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.response);
  } catch (error) {
    console.error('❌ Email error:', error.message);
  }
};

module.exports = {
  sendExpenseNotificationEmail
};