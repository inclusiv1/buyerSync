import nodemailer from 'nodemailer';

type InvitationEmail = {
  to: string;
  inviterName: string;
  inviterEmail: string;
  searchName: string;
  inviteLink: string;
  expiresAt: Date;
};

export type EmailDeliveryResult = {
  sent: boolean;
  messageId?: string;
  reason?: 'not_configured';
};

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const buildInvitationMessage = ({ inviterName, inviterEmail, searchName, inviteLink, expiresAt }: Omit<InvitationEmail, 'to'>) => {
  const expiration = expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const safeInviter = escapeHtml(inviterName);
  const safeInviterEmail = escapeHtml(inviterEmail);
  const safeSearch = escapeHtml(searchName);
  const safeLink = escapeHtml(inviteLink);

  return {
    subject: `${inviterName} invited you to ${searchName} on Home Buyer Sync`,
    text: `${inviterName} invited you to collaborate on “${searchName}” in Home Buyer Sync.\n\nAccept the invitation: ${inviteLink}\n\nThis link expires on ${expiration}. If you were not expecting this invitation, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #292929; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #34764f;">Join ${safeSearch}</h1>
        <p><strong>${safeInviter}</strong> (${safeInviterEmail}) invited you to collaborate on a home search in Home Buyer Sync.</p>
        <p style="margin: 28px 0;">
          <a href="${safeLink}" style="background: #34764f; color: #ffffff; display: inline-block; padding: 12px 20px; text-decoration: none;">Accept invitation</a>
        </p>
        <p style="color: #666666; font-size: 13px;">This invitation expires on ${expiration}. If you were not expecting it, you can ignore this email.</p>
      </div>
    `.trim(),
  };
};

export const buildInvitationEmailDraftUrl = (invitation: InvitationEmail) => {
  const message = buildInvitationMessage(invitation);
  const query = new URLSearchParams({ subject: message.subject, body: message.text });
  return `mailto:${encodeURIComponent(invitation.to)}?${query.toString()}`;
};

export const sendInvitationEmail = async (invitation: InvitationEmail): Promise<EmailDeliveryResult> => {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return { sent: false, reason: 'not_configured' };

  const port = Number(process.env.SMTP_PORT || 1025);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number');
  }

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: user ? { user, pass: pass || '' } : undefined,
  });
  const message = buildInvitationMessage(invitation);
  const result = await transporter.sendMail({
    from: process.env.SMTP_FROM?.trim() || 'Home Buyer Sync <no-reply@homebuyersync.local>',
    replyTo: invitation.inviterEmail,
    to: invitation.to,
    ...message,
  });

  return { sent: true, messageId: result.messageId };
};