const express = require('express');
const {
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  approveEvent,
  getMyEvents,
  getEventStats,
  publishEvent
} = require('../controllers/eventController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public routes (with optional auth to differentiate admin)
router.get('/', optionalAuth, getEvents);

// Organizer routes (specific routes before :id parameter routes)
router.post('/', protect, authorize('Organizer', 'Admin'), createEvent);
router.get('/organizer/my-events', protect, authorize('Organizer', 'Admin'), getMyEvents);
router.put('/:id/publish', protect, authorize('Organizer', 'Admin'), publishEvent);

// Routes with :id parameter (must come after specific routes)
router.get('/:id', getEvent);
router.put('/:id', protect, authorize('Organizer', 'Admin'), updateEvent);
router.delete('/:id', protect, authorize('Organizer', 'Admin'), deleteEvent);
router.get('/:id/stats', protect, authorize('Organizer', 'Admin'), getEventStats);

// Admin routes
router.put('/:id/approve', protect, authorize('Admin'), approveEvent);

module.exports = router;
