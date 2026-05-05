const nodemailer = require('nodemailer');

// Configure the transporter
// For Gmail, use an "App Password", not your regular password!
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email notification when a new expense is added
 * @param {Array<string>} emails - Array of recipient email addresses
 * @param {string} groupName - Name of the group
 * @param {string} expenseDescription - Description of the expense
 * @param {number} amount - Total amount of the expense
 * @param {string} addedBy - Name of the user who added it
 */
const sendExpenseNotificationEmail = async (emails, groupName, expenseDescription, amount, addedBy) => {
  if (!emails || emails.length === 0) return;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('EMAIL_USER or EMAIL_PASS not set in .env. Skipping email notification.');
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: emails, // Can be an array of emails
    subject: `New Expense in ${groupName}: ${expenseDescription}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #333;">New Expense Added!</h2>
        <p style="font-size: 16px; color: #555;">
          <strong>${addedBy}</strong> just added a new expense to the group <strong>${groupName}</strong>.
        </p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0; font-size: 16px;"><strong>Description:</strong> ${expenseDescription}</p>
          <p style="margin: 5px 0; font-size: 16px;"><strong>Total Amount:</strong> ₹${Number(amount).toFixed(2)}</p>
        </div>
        <p style="font-size: 14px; color: #888;">
          Log in to your Splitwise account to see the full details and how it affects your balance.
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Expense notification emails sent successfully:', info.response);
  } catch (error) {
    console.error('Error sending expense notification email:', error);
  }
};

module.exports = {
  sendExpenseNotificationEmail
};
