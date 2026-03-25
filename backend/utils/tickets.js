const QRCode = require('qrcode');
const { sendMail } = require('./mailer');

const buildTicketPayload = (registration, event) => ({
  ticketId: registration.ticketId,
  registrationId: registration._id,
  eventId: event._id,
  eventTitle: event.title,
  participantName: registration.participantName,
  participantEmail: registration.email
});

const getQrAttachment = (ticketId, qrDataUrl) => {
  const base64 = (qrDataUrl || '').split(',')[1] || '';
  return {
    filename: `ticket-${ticketId}.png`,
    content: base64,
    encoding: 'base64',
    cid: 'ticket-qr'
  };
};

const sendTicketEmail = async (registration, event, qrDataUrl) => {
  const subject = `Your Ticket: ${event.title}`;
  const html = `
    <p>Hi ${registration.participantName},</p>
    <p>Your ticket for <strong>${event.title}</strong> is confirmed.</p>
    <p><strong>Ticket ID:</strong> ${registration.ticketId}</p>
    <p>Please keep this QR code ready at check-in.</p>
    <img src="cid:ticket-qr" alt="Ticket QR" style="max-width:240px;" />
    <p>Thanks,<br/>EventHub</p>
  `;

  await sendMail({
    to: registration.email,
    subject,
    html,
    attachments: [getQrAttachment(registration.ticketId, qrDataUrl)]
  });
};

const issueTicket = async (registration, event, options = {}) => {
  const { forceEmail = false } = options;
  let qrDataUrl = registration.ticketQr;

  if (!qrDataUrl) {
    const payload = buildTicketPayload(registration, event);
    qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload));

    registration.ticketQr = qrDataUrl;
    registration.ticketIssuedAt = new Date();
    await registration.save();
  }

  if (forceEmail || !options.skipEmail) {
    await sendTicketEmail(registration, event, qrDataUrl);
  }

  return registration;
};

module.exports = {
  issueTicket
};
