const express = require('express');
const {
  submitFeedback,
  getEventFeedback,
  exportEventFeedback,
  getFeedback,
  updateFeedback,
  deleteFeedback,
  markHelpful,
  getMyFeedback
} = require('../controllers/feedbackController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/event/:eventId', protect, getEventFeedback);
router.get('/event/:eventId/export', protect, exportEventFeedback);

// Protected routes
router.post('/', protect, submitFeedback);
router.get('/my-feedback', protect, getMyFeedback);
router.get('/:id', protect, getFeedback);
router.put('/:id', protect, updateFeedback);
router.delete('/:id', protect, deleteFeedback);
router.put('/:id/helpful', protect, markHelpful);

module.exports = router;
