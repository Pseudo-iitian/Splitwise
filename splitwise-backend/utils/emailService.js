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

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sendChatNotificationEmail = async ({
  recipients,
  groupName,
  senderName,
  senderEmail,
  messageType,
  messageText,
  fileName,
  chatUrl,
}) => {
  const validRecipients = Array.from(
    new Set((recipients || []).map(email => email?.trim()).filter(Boolean))
  );

  if (!validRecipients.length || !chatUrl) return false;

  const safeGroupName = escapeHtml(groupName || 'your group');
  const safeSenderName = escapeHtml(senderName || 'A group member');
  const safeSenderEmail = escapeHtml(senderEmail || '');
  const safeMessageText = escapeHtml(messageText || '');
  const safeFileName = escapeHtml(fileName || 'attachment');

  let badgeLabel = 'New chat message';
  let contentLabel = 'Message';
  let contentHtml = safeMessageText || 'Open the group chat to see the latest update.';

  if (messageType === 'poll') {
    badgeLabel = 'New poll created';
    contentLabel = 'Poll';
  } else if (['image', 'video', 'audio', 'file'].includes(messageType)) {
    badgeLabel = 'New media shared';
    contentLabel = 'Attachment';
    contentHtml = `Shared ${escapeHtml(messageType)}: <strong>${safeFileName}</strong>`;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'SplitKaro', email: process.env.BREVO_SENDER_EMAIL },
        to: validRecipients.map(email => ({ email })),
        subject: `New message in ${groupName || 'your group'}`,
        htmlContent: `
          <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e5e7eb">
              <div style="padding:28px 28px 18px;background:linear-gradient(135deg,#111827 0%,#1f2937 60%,#065f46 100%);color:#ffffff">
                <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.12);font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">
                  ${badgeLabel}
                </div>
                <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.2">New activity in ${safeGroupName}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#d1fae5">
                  <strong>${safeSenderName}</strong>${safeSenderEmail ? ` (${safeSenderEmail})` : ''} sent a new chat update.
                </p>
              </div>
              <div style="padding:28px">
                <div style="padding:18px 20px;border-radius:20px;background:#f9fafb;border:1px solid #e5e7eb">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280">${contentLabel}</p>
                  <div style="font-size:16px;line-height:1.7;color:#111827">${contentHtml}</div>
                </div>
                <div style="margin-top:24px">
                  <a href="${chatUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#10b981;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700">
                    Open Group Chat
                  </a>
                </div>
                <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7280">
                  If you are already logged in, this link will open the chat tab directly.
                </p>
                <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#6b7280">
                  Direct link: <a href="${chatUrl}" style="color:#059669;text-decoration:none">${chatUrl}</a>
                </p>
              </div>
            </div>
          </div>
        `
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('❌ Brevo chat notification API error:', err);
      return false;
    }

    console.log('✅ Chat notification email sent via Brevo API');
    return true;
  } catch (err) {
    console.error('❌ Chat notification email error:', err.message);
    return false;
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

const sendPasswordResetEmail = async ({
  toEmail,
  toName,
  resetLink
}) => {
  if (!toEmail || !resetLink) return false;

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
        subject: 'Reset your Splitwise password',
        htmlContent: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
            <h2>Reset your password</h2>
            <p>Hi ${toName || 'there'},</p>
            <p>We received a request to reset your Splitwise password.</p>
            <p>
              <a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600">
                Reset Password
              </a>
            </p>
            <p>If the button does not work, use this link:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p style="color:#6b7280;font-size:13px">This link expires in 5 minutes. If you did not request this, you can ignore this email.</p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('❌ Brevo password reset API error:', err);
      return false;
    }

    console.log('✅ Password reset email sent via Brevo API');
    return true;
  } catch (err) {
    console.error('❌ Password reset email error:', err.message);
    return false;
  }
};

module.exports = {
  sendExpenseNotificationEmail,
  sendChatNotificationEmail,
  sendPaymentReminderEmail,
  sendPasswordResetEmail
};
