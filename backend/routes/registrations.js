const express = require('express');
const {
  registerForEvent,
  getMyRegistrations,
  getRegistration,
  getEventRegistrations,
  cancelRegistration,
  updateRegistrationStatus,
  updatePaymentStatus,
  resendTicketEmail,
  checkInParticipant,
  getRegistrationStats,
  getOrganizerRegistrations,
  uploadPaymentProof,
  createTeamRegistration,
  getMyTeams,
  getMyPendingTeamInvites,
  addTeamInvites,
  removeTeamInvite,
  respondToMyTeamInvite
} = require('../controllers/registrationController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Team registration routes
router.post('/team/create', protect, authorize('Participant'), createTeamRegistration);
router.get('/team/my-teams', protect, authorize('Participant'), getMyTeams);
router.get('/team/invites/me', protect, authorize('Participant'), getMyPendingTeamInvites);
router.post('/team/:teamId/invites', protect, authorize('Participant'), addTeamInvites);
router.delete('/team/:teamId/invites/:inviteId', protect, authorize('Participant'), removeTeamInvite);
router.put('/team/:teamId/invites/respond', protect, authorize('Participant'), respondToMyTeamInvite);

// Participant routes
router.post('/', protect, authorize('Participant', 'Organizer', 'Admin'), registerForEvent);
router.get('/my-registrations', protect, authorize('Participant', 'Organizer', 'Admin'), getMyRegistrations);
router.put('/:id/cancel', protect, authorize('Participant', 'Organizer', 'Admin'), cancelRegistration);
router.post('/:id/payment-proof', protect, upload.single('proof'), uploadPaymentProof);
// Organizer routes (more specific paths must be registered before :id)
router.get('/event/:eventId', protect, authorize('Organizer', 'Admin'), getEventRegistrations);
router.put('/:id/payment', protect, authorize('Organizer', 'Admin'), updatePaymentStatus);
router.put('/:id/resend-ticket', protect, authorize('Participant', 'Organizer', 'Admin'), resendTicketEmail);
router.put('/:id/checkin', protect, authorize('Organizer', 'Admin'), checkInParticipant);
router.put('/:id/status', protect, authorize('Organizer', 'Admin'), updateRegistrationStatus);
router.get('/organizer/my-registrations', protect, authorize('Organizer', 'Admin'), getOrganizerRegistrations);

// Admin routes
router.get('/stats/overview', protect, authorize('Admin'), getRegistrationStats);

// Get single registration (owner or organizer/admin)
router.get('/:id', protect, getRegistration);

module.exports = router;
