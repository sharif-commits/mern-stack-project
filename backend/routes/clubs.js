const express = require('express');
const {
  createClub,
  getClubs,
  getClub,
  updateClub,
  deleteClub,
  addMember,
  removeMember,
  getClubStats
} = require('../controllers/clubController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getClubs);
router.get('/:id', getClub);

// Admin and Club Head routes
router.post('/', protect, authorize('Admin'), createClub);
router.put('/:id', protect, authorize('Admin', 'Organizer'), updateClub);
router.delete('/:id', protect, authorize('Admin'), deleteClub);
router.post('/:id/members', protect, authorize('Admin', 'Organizer'), addMember);
router.delete('/:id/members/:userId', protect, authorize('Admin', 'Organizer'), removeMember);
router.get('/:id/stats', protect, authorize('Admin', 'Organizer'), getClubStats);

module.exports = router;
