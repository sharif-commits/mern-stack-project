const User = require('../models/User');

const generatePassword = () => `Org@${Math.random().toString(36).slice(2, 8)}`;

const slugifyEmail = (value) => {
  if (!value) return 'organizer';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'organizer';
};

const generateOrganizerEmail = async (base, domain = 'eventhub.local') => {
  const baseSlug = slugifyEmail(base);
  let attempt = 0;

  while (attempt < 50) {
    const suffix = attempt === 0 ? '' : `-${attempt}`;
    const candidate = `${baseSlug}${suffix}@${domain}`;
    const exists = await User.findOne({ email: candidate });
    if (!exists) return candidate;
    attempt += 1;
  }

  return `${baseSlug}-${Date.now()}@${domain}`;
};

module.exports = { generatePassword, slugifyEmail, generateOrganizerEmail };
