const nodemailer = require('nodemailer');

const hasMailerConfig = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
};

const transporter = hasMailerConfig()
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || process.env.SMTP_PORT) === 'true' || Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

const sendMail = async ({ to, subject, html, text, attachments }) => {
  if (!transporter) {
    return { sent: false, skipped: true };
  }

  const result = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
    attachments
  });

  return { sent: true, skipped: false, result };
};

const sendOrganizerProvisionMail = async ({ to, organizerName, password }) => {
  const subject = 'Your Organizer Account Credentials';
  const text = `Hello ${organizerName},\n\nYour organizer account has been created.\nEmail: ${to}\nPassword: ${password}\n\nPlease change your password through Admin request after your first login.\n\n- EventHub`;
  const html = `
    <p>Hello ${organizerName},</p>
    <p>Your organizer account has been created.</p>
    <p><strong>Email:</strong> ${to}</p>
    <p><strong>Password:</strong> ${password}</p>
    <p>Please change your password through Admin request after your first login.</p>
    <p>- EventHub</p>
  `;
  return sendMail({ to, subject, text, html });
};

const sendOrganizerResetMail = async ({ to, organizerName, password }) => {
  const subject = 'Your Organizer Password Has Been Reset';
  const text = `Hello ${organizerName},\n\nYour organizer password has been reset by Admin.\nEmail: ${to}\nNew Password: ${password}\n\nPlease use this password to login.\n\n- EventHub`;
  const html = `
    <p>Hello ${organizerName},</p>
    <p>Your organizer password has been reset by Admin.</p>
    <p><strong>Email:</strong> ${to}</p>
    <p><strong>New Password:</strong> ${password}</p>
    <p>Please use this password to login.</p>
    <p>- EventHub</p>
  `;
  return sendMail({ to, subject, text, html });
};

const sendTeamInviteMail = async ({
  to,
  invitedBy,
  teamName,
  eventTitle,
  inviteLink,
  inviteCode
}) => {
  const subject = `Team Invite: ${teamName} (${eventTitle})`;
  const text = `Hello,\n\n${invitedBy} invited you to join team "${teamName}" for "${eventTitle}".\n\nInvite Link: ${inviteLink}\nInvite Code: ${inviteCode}\n\nPlease login with this email and accept the invite.\n\n- EventHub`;
  const html = `
    <p>Hello,</p>
    <p><strong>${invitedBy}</strong> invited you to join team <strong>${teamName}</strong> for <strong>${eventTitle}</strong>.</p>
    <p><a href="${inviteLink}">Accept Team Invite</a></p>
    <p><strong>Invite Code:</strong> ${inviteCode}</p>
    <p>Please login with this email and accept the invite.</p>
    <p>- EventHub</p>
  `;

  return sendMail({ to, subject, text, html });
};

module.exports = {
  sendMail,
  transporter,
  hasMailerConfig,
  sendOrganizerProvisionMail,
  sendOrganizerResetMail,
  sendTeamInviteMail
};