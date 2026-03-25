const buildEventMessage = (event, baseUrl) => {
  const eventUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/event/${event._id}` : '';
  const fee = event.registrationFee ? `₹${event.registrationFee}` : 'Free';

  const formatDMY = (value) => {
    if (!value) return 'TBD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'TBD';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const deadline = event.registrationDeadline ? formatDMY(event.registrationDeadline) : 'TBD';
  const start = event.date ? formatDMY(event.date) : 'TBD';
  const end = event.endDate ? formatDMY(event.endDate) : start;

  const lines = [
    `**${event.title}**`,
    event.description ? event.description.slice(0, 180) : null,
    `Type: ${event.type || 'Event'}`,
    `Eligibility: ${event.eligibility || 'All'}`,
    `Fee: ${fee}`,
    `Dates: ${start} - ${end}`,
    `Registration Deadline: ${deadline}`,
    event.venue ? `Venue: ${event.venue}` : (event.location ? `Location: ${event.location}` : null),
    eventUrl ? `More: ${eventUrl}` : null
  ].filter(Boolean);

  return lines.join('\n');
};

const postEventToDiscord = async (event, webhookUrl) => {
  if (!webhookUrl) {
    return;
  }

  const content = buildEventMessage(event, process.env.FRONTEND_URL);

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  } catch (error) {
    // Swallow errors to avoid breaking event approval flow.
  }
};

module.exports = {
  postEventToDiscord
};
