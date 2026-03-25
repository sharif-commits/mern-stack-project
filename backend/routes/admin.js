const express = require('express');
const {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  promoteToOrganizer,
  getSystemStats,
  getPendingEvents,
  getAllEvents,
  getAllClubs,
  createOrganizer,
  resetOrganizerPassword,
  getOrganizerPasswordResetRequests,
  reviewOrganizerPasswordResetRequest
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require Admin role
router.use(protect);
router.use(authorize('Admin'));

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/promote', promoteToOrganizer);
router.put('/users/:id/reset-password', resetOrganizerPassword);
router.get('/password-reset-requests', getOrganizerPasswordResetRequests);
router.put('/password-reset-requests/:id/review', reviewOrganizerPasswordResetRequest);
router.post('/organizers', createOrganizer);

// System statistics
router.get('/stats', getSystemStats);

// Event management
router.get('/events', getAllEvents);
router.get('/pending-events', getPendingEvents);
router.get('/clubs', getAllClubs);

module.exports = router;
