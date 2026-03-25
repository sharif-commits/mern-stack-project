const express = require('express');
const {
  createDiscussion,
  getEventDiscussions,
  getDiscussion,
  replyToDiscussion,
  deleteReply,
  updateDiscussion,
  deleteDiscussion,
  togglePin,
  reactToDiscussion,
  reactToReply
} = require('../controllers/discussionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/event/:eventId', getEventDiscussions);
router.get('/:id', getDiscussion);

// Protected routes (registered participants)
router.post('/', protect, createDiscussion);
router.post('/:id/reply', protect, replyToDiscussion);
router.delete('/:id/replies/:replyId', protect, deleteReply);
router.put('/:id/react', protect, reactToDiscussion);
router.put('/:id/replies/:replyId/react', protect, reactToReply);
router.put('/:id', protect, updateDiscussion);
router.delete('/:id', protect, deleteDiscussion);

// Organizer/Admin routes
router.put('/:id/pin', protect, authorize('Organizer', 'Admin'), togglePin);

module.exports = router;
