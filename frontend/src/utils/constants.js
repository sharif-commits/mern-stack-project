// User Roles
export const USER_ROLES = {
  PARTICIPANT: 'Participant',
  ORGANIZER: 'Organizer',
  ADMIN: 'Admin',
};

// Participant Types
export const PARTICIPANT_TYPES = {
  IIIT: 'IIIT',
  NON_IIIT: 'Non-IIIT',
};

// Event Types
export const EVENT_TYPES = {
  EVENT: 'Event',
  WORKSHOP: 'Workshop',
  COMPETITION: 'Competition',
  SEMINAR: 'Seminar',
  MERCHANDISE: 'Merchandise',
};

// Event Participant Types
export const EVENT_PARTICIPANT_TYPES = {
  INDIVIDUAL: 'Individual',
  TEAM: 'Team',
  BOTH: 'Both',
};

// Event Status
export const EVENT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PUBLISHED: 'published',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  // Aliases for backward compatibility
  UPCOMING: 'upcoming',
  PAST: 'past',
};

// Registration Status
export const REGISTRATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
};

// Payment Status (for Merchandise)
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FREE: 'free',
  FAILED: 'failed',
};

// Event Categories
export const EVENT_CATEGORIES = [
  'Technical',
  'Cultural',
  'Sports',
  'Academic',
  'Workshop',
  'Competition',
  'Seminar',
  'Other',
];

// Organizer Categories
export const ORGANIZER_CATEGORIES = [
  'Technical Club',
  'Cultural Club',
  'Sports Club',
  'Literary Club',
  'Council',
  'Fest Team',
  'Other',
];

// Club Categories
export const CLUB_CATEGORIES = [
  'Technical',
  'Cultural',
  'Sports',
  'Academic',
  'Social',
  'Arts',
];

// Areas of Interest
export const AREAS_OF_INTEREST = [
  'Web Development',
  'Mobile Development',
  'Machine Learning',
  'Data Science',
  'Cybersecurity',
  'Cloud Computing',
  'Design',
  'Music',
  'Dance',
  'Drama',
  'Photography',
  'Sports',
  'Literature',
  'Debate',
  'Gaming',
];

// Eligibility Types
export const ELIGIBILITY_TYPES = {
  ALL: 'All',
  IIIT_ONLY: 'IIIT Only',
  EXTERNAL_ONLY: 'External Only',
};

// Form Field Types for Dynamic Forms
export const FORM_FIELD_TYPES = {
  TEXT: 'text',
  EMAIL: 'email',
  NUMBER: 'number',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  FILE: 'file',
  DATE: 'date',
  TIME: 'time',
};

// Validation Rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 6,
  EMAIL_IIIT_DOMAIN: '@iiit.ac.in',
  EMAIL_IIIT_DOMAINS: ['@iiit.ac.in', '@students.iiit.ac.in', '@research.iiit.ac.in'],
  EVENT_TITLE_MIN_LENGTH: 3,
  EVENT_DESCRIPTION_MIN_LENGTH: 20,
  EVENT_LOCATION_MIN_LENGTH: 5,
  MAX_EVENT_CAPACITY: 10000,
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_USER: 'ems_auth_user',
  EVENTS: 'ems_events',
  REGISTRATIONS: 'ems_registrations',
  USERS: 'ems_users',
};

// Route Paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',

  // Participant Routes
  DASHBOARD: '/dashboard',
  ONBOARDING: '/onboarding',
  BROWSE_EVENTS: '/events',
  EVENT_DETAILS: '/event/:id',
  CLUBS: '/clubs',
  CLUB_DETAILS: '/club/:id',
  PROFILE: '/profile',
  TICKET: '/ticket/:id',
  TEAMS: '/dashboard/teams',

  // Organizer Routes
  ORGANIZER_DASHBOARD: '/organizer/dashboard',
  ORGANIZER_EVENTS: '/organizer/events',
  CREATE_EVENT: '/organizer/events/create',
  EDIT_EVENT: '/organizer/events/edit/:id',
  ORGANIZER_MANAGE_EVENT: '/organizer/events/:eventId/manage',
  ORGANIZER_REGISTRATIONS: '/organizer/registrations',
  ORGANIZER_PAYMENTS: '/organizer/payments',
  ORGANIZER_CHECKIN: '/organizer/checkin/:eventId',

  // Shared Routes
  FORUM: '/forum/:eventId',
  FEEDBACK: '/feedback/:eventId',

  // Admin Routes
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_EVENTS: '/admin/events',
  ADMIN_CLUBS: '/admin/clubs',
  ADMIN_USERS: '/admin/users',
};
