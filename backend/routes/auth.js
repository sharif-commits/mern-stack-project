const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfile,
  updatePassword,
  requestOrganizerPasswordReset,
  getMyOrganizerPasswordResetRequests
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/updateprofile', protect, updateProfile);
router.put('/updatepassword', protect, updatePassword);
router.post('/organizer/password-reset-request', protect, requestOrganizerPasswordReset);
router.get('/organizer/password-reset-requests', protect, getMyOrganizerPasswordResetRequests);

module.exports = router;
