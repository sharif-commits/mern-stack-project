import { VALIDATION } from './constants';

export const getOrganizerName = (organizer, organizerName) => {
  if (organizerName && typeof organizerName === 'string') return organizerName;
  if (!organizer) return 'Organizer';
  if (typeof organizer === 'string') return organizer;

  const name = `${organizer.firstName || ''} ${organizer.lastName || ''}`.trim();
  if (name) return name;
  if (organizer.name) return organizer.name;
  if (organizer.email) return organizer.email;
  if (organizer._id) return organizer._id;
  return 'Organizer';
};

/**
 * Format date to readable string
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });

  // e.g. "Monday, 24/02/2026"
  return `${weekday}, ${day}/${month}/${year}`;
};

/**
 * Format date to short format
 */
export const formatDateShort = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  // dd/mm/yyyy
  return `${day}/${month}/${year}`;
};

/**
 * Format event date with time
 */
export const formatEventDate = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  const datePart = `${day}/${month}/${year}`;

  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;

  // dd/mm/yyyy, hh:mm AM/PM IST
  return `${datePart}, ${displayHour}:${minutes} ${ampm} IST`;
};

/**
 * Format time to 12-hour format
 */
export const formatTime = (timeString) => {
  if (!timeString || typeof timeString !== 'string') {
    return 'TBD';
  }
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  // Display time explicitly in IST
  return `${displayHour}:${minutes} ${ampm} IST`;
};

/**
 * Validate email address
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate IIIT email
 */
export const isIIITEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase();
  return (VALIDATION.EMAIL_IIIT_DOMAINS || [VALIDATION.EMAIL_IIIT_DOMAIN])
    .some((domain) => lower.endsWith(domain));
};

/**
 * Validate password strength
 */
export const isValidPassword = (password) => {
  return password.length >= VALIDATION.PASSWORD_MIN_LENGTH;
};

/**
 * Check if event is full
 */
export const isEventFull = (event) => {
  if (event.type === 'Merchandise') {
    const variants = event.merchandise?.variants || [];
    const stock = variants.length > 0
      ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : (event.merchandise?.stock || 0);
    return stock <= 0;
  }
  const capacity = event.capacity || event.maxParticipants || 0;
  if (capacity <= 0) return false;
  return (event.registered || 0) >= capacity;
};

/**
 * Check if registration deadline has passed
 */
export const isRegistrationClosed = (deadline) => {
  return new Date(deadline) < new Date();
};

/**
 * Get event availability status
 */
export const getEventAvailability = (event) => {
  if (event.type === 'Merchandise') {
    const variants = event.merchandise?.variants || [];
    const stock = variants.length > 0
      ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : (event.merchandise?.stock || 0);
    if (stock <= 0) return { text: 'Sold Out', class: 'almost-full', available: 0 };
    return { text: 'Available', class: 'available', available: stock };
  }

  const capacity = event.capacity || event.maxParticipants || 0;
  const registered = event.registered || 0;
  const available = capacity - registered;
  const percentage = capacity > 0 ? (registered / capacity) * 100 : 0;

  if (percentage >= 90) return { text: 'Almost Full!', class: 'almost-full', available };
  if (percentage >= 70) return { text: 'Filling Up Fast', class: 'filling-up', available };
  return { text: 'Available', class: 'available', available };
};

/**
 * Calculate days until event
 */
export const getDaysUntilEvent = (eventDate) => {
  const today = new Date();
  const event = new Date(eventDate);
  const diffTime = event - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Truncate text to specified length
 */
export const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Generate unique ID (for mock data)
 */
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Generate ticket ID
 */
export const generateTicketId = () => {
  return 'TKT' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2, 4).toUpperCase();
};

/**
 * Search events by query
 */
export const searchEvents = (events, query) => {
  if (!query) return events;

  const normalizeOrganizer = (event) => getOrganizerName(event.organizer, event.organizerName);
  const lowerQuery = query.toLowerCase();
  const fuzzyMatch = (text, needle) => {
    if (!text || !needle) return false;
    let textIndex = 0;
    const lowered = text.toLowerCase();
    for (let i = 0; i < needle.length; i += 1) {
      textIndex = lowered.indexOf(needle[i], textIndex);
      if (textIndex === -1) return false;
      textIndex += 1;
    }
    return true;
  };

  return events.filter(event => {
    const title = (event.title || '').toLowerCase();
    const organizer = normalizeOrganizer(event).toLowerCase();
    const matchesName =
      title.includes(lowerQuery) ||
      organizer.includes(lowerQuery) ||
      fuzzyMatch(title, lowerQuery) ||
      fuzzyMatch(organizer, lowerQuery);

    return (
      matchesName ||
      (event.location || '').toLowerCase().includes(lowerQuery) ||
      (event.description || '').toLowerCase().includes(lowerQuery) ||
      event.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  });
};

/**
 * Filter events by criteria
 */
export const filterEvents = (events, filters) => {
  let filtered = [...events];

  if (filters.type && filters.type !== 'All') {
    filtered = filtered.filter(e => e.type === filters.type);
  }

  if (filters.category && filters.category !== 'All') {
    filtered = filtered.filter(e => e.category === filters.category);
  }

  if (filters.eligibility && filters.eligibility !== 'All') {
    filtered = filtered.filter(e => e.eligibility === filters.eligibility);
  }

  if (filters.dateFrom) {
    filtered = filtered.filter(e => new Date(e.date) >= new Date(filters.dateFrom));
  }

  if (filters.dateTo) {
    filtered = filtered.filter(e => new Date(e.date) <= new Date(filters.dateTo));
  }

  if (filters.followedOnly && filters.followedClubs?.length > 0) {
    filtered = filtered.filter(e => {
      const clubId = e.clubId?._id || e.clubId;
      const organizerId = e.organizer?._id || e.organizer || e.organizerId;
      return filters.followedClubs.includes(clubId) || filters.followedClubs.includes(organizerId);
    });
  }

  return filtered;
};

/**
 * Sort events by criteria
 */
export const sortEvents = (events, sortBy) => {
  const sorted = [...events];

  switch (sortBy) {
    case 'date':
      return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'capacity':
      return sorted.sort((a, b) => b.capacity - a.capacity);
    case 'registered':
      return sorted.sort((a, b) => b.registered - a.registered);
    case 'price':
      return sorted.sort((a, b) => a.registrationFee - b.registrationFee);
    default:
      return sorted;
  }
};

/**
 * Get trending events (most registrations in last 24h)
 */
export const getTrendingEvents = (events, limit = 5) => {
  // In real app, this would check registration timestamp
  // For mock, just return events with high registration percentage
  return events
    .filter(e => e.registered > 0)
    .sort((a, b) => {
      const percentA = (a.registered / a.capacity) * 100;
      const percentB = (b.registered / b.capacity) * 100;
      return percentB - percentA;
    })
    .slice(0, limit);
};

/**
 * Export data to CSV
 */
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        return typeof value === 'string' && (value.includes(',') || value.includes('"'))
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Get color for category
 */
export const getCategoryColor = (category) => {
  const colors = {
    'Technology': '#3b82f6',
    'Entertainment': '#ec4899',
    'Food & Drink': '#f59e0b',
    'Sports': '#10b981',
    'Education': '#8b5cf6',
    'Business': '#6366f1',
    'Arts & Culture': '#f43f5e',
    'Gaming': '#06b6d4',
    'Workshop': '#14b8a6',
    'Competition': '#ef4444',
  };
  return colors[category] || '#6b7280';
};

/**
 * Get event status based on date
 */
export const getEventStatus = (eventDate) => {
  const now = new Date();
  const date = new Date(eventDate);

  // Normalize dates to compare without time
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  if (date > now) {
    return 'upcoming';
  } else if (date.getTime() === now.getTime()) {
    return 'ongoing';
  } else {
    return 'past';
  }
};

/**
 * Calculate event statistics
 */
export const calculateEventStats = (registrations) => {
  const total = registrations.length;
  const confirmed = registrations.filter(r => r.status === 'confirmed').length;
  const cancelled = registrations.filter(r => r.status === 'cancelled').length;
  const pending = registrations.filter(r => r.status === 'pending').length;

  const totalRevenue = registrations
    .filter(r => r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  return {
    total,
    confirmed,
    cancelled,
    pending,
    totalRevenue,
    confirmationRate: total > 0 ? ((confirmed / total) * 100).toFixed(1) : 0,
  };
};
