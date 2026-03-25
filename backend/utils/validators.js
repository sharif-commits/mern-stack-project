// Email validation
exports.isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// IIIT email validation
const IIIT_EMAIL_DOMAINS = ['@iiit.ac.in', '@students.iiit.ac.in', '@research.iiit.ac.in'];

exports.isIIITEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase();
  return IIIT_EMAIL_DOMAINS.some((domain) => lower.endsWith(domain));
};

// Phone number validation (Indian format)
exports.isValidPhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
};

// Password strength validation
exports.isStrongPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

// Validate MongoDB ObjectId
exports.isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Sanitize input (remove HTML tags)
exports.sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/<[^>]*>/g, '');
};

// Validate date is in future
exports.isFutureDate = (date) => {
  return new Date(date) > new Date();
};

// Validate date range
exports.isValidDateRange = (startDate, endDate) => {
  return new Date(startDate) <= new Date(endDate);
};
