const crypto = require('crypto');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const User = require('../models/User');
const Team = require('../models/Team');
const { issueTicket } = require('../utils/tickets');

const normalizeEligibility = (eligibility) => {
  if (!eligibility) return 'All';
  const value = String(eligibility).trim().toLowerCase();

  if (
    value === 'all' ||
    value === 'both' ||
    value.includes('iiit+external') ||
    value.includes('iiit & external') ||
    value.includes('iiit and external')
  ) {
    return 'All';
  }

  if (value.includes('iiit')) {
    return value.includes('non') || value.includes('external') ? 'Non-IIIT' : 'IIIT';
  }

  if (value.includes('external') || value.includes('non')) {
    return 'Non-IIIT';
  }

  return 'All';
};

const generateInviteToken = () => crypto.randomBytes(24).toString('hex');
const generateInviteCode = () => `TEAM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const buildInviteLinks = (team) => {
  return (team.invites || []).map((invite) => ({
    id: invite._id,
    email: invite.email,
    status: invite.status,
    acceptedBy: invite.acceptedBy,
    respondedAt: invite.respondedAt
  }));
};

const completeTeamIfReady = async (team, event) => {
  if (team.status !== 'forming') {
    return { completed: false, reason: 'Team is not in forming state' };
  }

  const acceptedInvites = (team.invites || []).filter(invite => invite.status === 'accepted');
  const requiredInvites = Math.max((team.desiredTeamSize || 1) - 1, 0);

  if (acceptedInvites.length !== requiredInvites || team.members.length !== team.desiredTeamSize) {
    return { completed: false, reason: 'Team is not fully formed yet' };
  }

  const alreadyRegistered = await Registration.countDocuments({
    event: event._id,
    user: { $in: team.members },
    status: { $ne: 'rejected' }
  });

  if (alreadyRegistered > 0) {
    return { completed: false, reason: 'One or more team members are already registered for this event' };
  }

  const activeRegistrations = await Registration.countDocuments({
    event: event._id,
    status: { $in: ['pending', 'confirmed', 'approved'] }
  });

  const capacity = event.capacity || event.maxParticipants;
  if (activeRegistrations + team.desiredTeamSize > capacity) {
    return { completed: false, reason: 'Not enough spots left to complete this team' };
  }

  const users = await User.find({ _id: { $in: team.members } }).select('firstName lastName email contactNumber');
  const userMap = new Map(users.map(user => [user._id.toString(), user]));
  const leaderUser = userMap.get(team.leader.toString());

  const teamMembersPayload = team.members
    .map(memberId => userMap.get(memberId.toString()))
    .filter(Boolean)
    .filter(user => user._id.toString() !== team.leader.toString())
    .map(user => ({
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.contactNumber || ''
    }));

  const createdRegistrations = [];
  for (const memberId of team.members) {
    const memberUser = userMap.get(memberId.toString());
    if (!memberUser) {
      continue;
    }

    const registration = await Registration.create({
      event: event._id,
      user: memberUser._id,
      participantName: `${memberUser.firstName} ${memberUser.lastName}`.trim(),
      email: memberUser.email,
      phone: memberUser.contactNumber || '',
      isTeam: true,
      team: team._id,
      teamName: team.teamName,
      teamLeader: {
        name: leaderUser ? `${leaderUser.firstName} ${leaderUser.lastName}`.trim() : '',
        email: leaderUser?.email || '',
        phone: leaderUser?.contactNumber || ''
      },
      teamMembers: teamMembersPayload,
      paymentAmount: 0,
      amountPaid: 0,
      paymentStatus: 'free',
      paymentApprovalStatus: 'not-required',
      status: 'confirmed'
    });

    await issueTicket(registration, event, { forceEmail: true });
    createdRegistrations.push(registration);
  }

  team.status = 'completed';
  team.completedAt = new Date();
  team.registrationIds = createdRegistrations.map(registration => registration._id);
  await team.save();

  event.registered = (event.registered || 0) + createdRegistrations.length;
  await event.save();

  return { completed: true, registrations: createdRegistrations };
};

// @desc    Create team registration (leader creates and invites members)
// @route   POST /api/registrations/team/create
// @access  Private (Participant)
exports.createTeamRegistration = async (req, res, next) => {
  try {
    const { eventId, teamName, desiredTeamSize, inviteEmails = [] } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot register for unapproved event' });
    }

    const participantMode =
      event.participantType === 'Both'
        ? 'Both'
        : event.participantType === 'Team' || event.allowTeams
          ? 'Team'
          : 'Individual';

    if (participantMode === 'Individual') {
      return res.status(400).json({ success: false, message: 'This event does not support team registration' });
    }

    if (event.type === 'Merchandise') {
      return res.status(400).json({ success: false, message: 'Merchandise events do not support team registration' });
    }

    const teamSize = Number(desiredTeamSize);
    if (!Number.isInteger(teamSize)) {
      return res.status(400).json({ success: false, message: 'Team size must be a valid integer' });
    }

    const minTeamSize = event.minTeamSize || 2;
    const maxTeamSize = event.maxTeamSize || 5;
    if (teamSize < minTeamSize || teamSize > maxTeamSize) {
      return res.status(400).json({ success: false, message: `Team size must be between ${minTeamSize} and ${maxTeamSize}` });
    }

    const normalizedInviteEmails = [...new Set((inviteEmails || []).map(email => String(email || '').trim().toLowerCase()).filter(Boolean))];
    if (normalizedInviteEmails.length !== teamSize - 1) {
      return res.status(400).json({
        success: false,
        message: `Please provide exactly ${teamSize - 1} unique invite emails for team size ${teamSize}`
      });
    }

    if (normalizedInviteEmails.includes(req.user.email.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Leader email cannot be added as an invite' });
    }

    const existingLeaderRegistration = await Registration.findOne({
      event: event._id,
      user: req.user.id,
      status: { $ne: 'rejected' }
    });
    if (existingLeaderRegistration) {
      return res.status(400).json({ success: false, message: 'You are already registered for this event' });
    }

    const existingLeaderTeam = await Team.findOne({
      event: event._id,
      members: req.user.id,
      status: { $ne: 'cancelled' }
    });
    if (existingLeaderTeam) {
      return res.status(400).json({ success: false, message: 'You are already part of a team for this event' });
    }

    const existingTeam = await Team.findOne({
      event: event._id,
      teamName,
      status: { $ne: 'cancelled' }
    });
    if (existingTeam) {
      return res.status(400).json({ success: false, message: 'A team with this name already exists for this event' });
    }

    const invites = normalizedInviteEmails.map(email => ({
      email,
      token: generateInviteToken(),
      status: 'pending'
    }));

    const team = await Team.create({
      event: event._id,
      leader: req.user.id,
      teamName,
      desiredTeamSize: teamSize,
      inviteCode: generateInviteCode(),
      invites,
      members: [req.user.id],
      status: 'forming'
    });

    await team.populate('leader', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Team created. Invites are now visible in invited participants\' Team Management page.',
      data: {
        ...team.toObject(),
        inviteLinks: buildInviteLinks(team)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get teams where user is leader/member
// @route   GET /api/registrations/team/my-teams
// @access  Private (Participant)
exports.getMyTeams = async (req, res, next) => {
  try {
    const teams = await Team.find({
      $or: [{ leader: req.user.id }, { members: req.user.id }],
      status: { $ne: 'cancelled' }
    })
      .populate('event', 'title date endDate venue location minTeamSize maxTeamSize')
      .populate('leader', 'firstName lastName email')
      .populate('members', 'firstName lastName email')
      .sort('-createdAt');

    const data = teams.map(team => ({
      ...team.toObject(),
      inviteLinks: buildInviteLinks(team)
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Add invites to forming team
// @route   POST /api/registrations/team/:teamId/invites
// @access  Private (Participant leader)
exports.addTeamInvites = async (req, res, next) => {
  try {
    const { inviteEmails = [] } = req.body;
    const team = await Team.findById(req.params.teamId).populate('event', 'maxTeamSize minTeamSize');

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (team.leader.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only team leader can add invites' });
    }

    if (team.status !== 'forming') {
      return res.status(400).json({ success: false, message: 'Cannot add invites after team completion' });
    }

    const normalized = [...new Set((inviteEmails || []).map(email => String(email || '').trim().toLowerCase()).filter(Boolean))];
    if (normalized.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one invite email' });
    }

    const existingEmails = new Set((team.invites || []).map(invite => invite.email));
    const availableSlots = Math.max(team.desiredTeamSize - team.members.length - (team.invites || []).filter(invite => invite.status === 'pending').length, 0);

    if (normalized.length > availableSlots) {
      return res.status(400).json({ success: false, message: `Only ${availableSlots} additional invite slots are available` });
    }

    normalized.forEach(email => {
      if (!existingEmails.has(email) && email !== req.user.email.toLowerCase()) {
        team.invites.push({ email, token: generateInviteToken(), status: 'pending' });
      }
    });

    await team.save();

    res.status(200).json({
      success: true,
      message: 'Invites added. Invited participants can respond inside Team Management.',
      data: {
        ...team.toObject(),
        inviteLinks: buildInviteLinks(team)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get invites for logged-in participant (in-app inbox)
// @route   GET /api/registrations/team/invites/me
// @access  Private (Participant)
exports.getMyPendingTeamInvites = async (req, res, next) => {
  try {
    const userEmail = req.user.email.toLowerCase();

    const teams = await Team.find({
      invites: { $elemMatch: { email: userEmail, status: 'pending' } },
      status: 'forming'
    })
      .populate('event', 'title date endDate venue location')
      .populate('leader', 'firstName lastName email')
      .populate('members', 'firstName lastName email')
      .sort('-createdAt');

    const data = teams.map((team) => {
      const myInvite = (team.invites || []).find((invite) => invite.email === userEmail && invite.status === 'pending');
      return {
        teamId: team._id,
        teamName: team.teamName,
        teamStatus: team.status,
        desiredTeamSize: team.desiredTeamSize,
        inviteCode: team.inviteCode,
        event: team.event,
        leader: team.leader,
        members: team.members,
        myInvite: myInvite
          ? {
              id: myInvite._id,
              email: myInvite.email,
              status: myInvite.status,
              createdAt: myInvite.createdAt,
              respondedAt: myInvite.respondedAt
            }
          : null,
        inviteTracking: (team.invites || []).map((invite) => ({
          id: invite._id,
          email: invite.email,
          status: invite.status,
          respondedAt: invite.respondedAt
        }))
      };
    });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Respond to invite from in-app inbox
// @route   PUT /api/registrations/team/:teamId/invites/respond
// @access  Private (Participant)
exports.respondToMyTeamInvite = async (req, res, next) => {
  try {
    const { action } = req.body;
    const normalizedAction = String(action || '').trim().toLowerCase();

    if (!['accept', 'decline'].includes(normalizedAction)) {
      return res.status(400).json({ success: false, message: 'Action must be accept or decline' });
    }

    const team = await Team.findById(req.params.teamId)
      .populate('event')
      .populate('leader', 'firstName lastName email')
      .populate('members', 'firstName lastName email');

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const userEmail = req.user.email.toLowerCase();
    const invite = (team.invites || []).find(existingInvite => existingInvite.email === userEmail);

    if (!invite) {
      return res.status(404).json({ success: false, message: 'No invite found for your account' });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Invite already ${invite.status}` });
    }

    if (normalizedAction === 'decline') {
      invite.status = 'declined';
      invite.respondedAt = new Date();
      await team.save();
      return res.status(200).json({ success: true, message: 'Invite declined' });
    }

    if (team.status !== 'forming') {
      return res.status(400).json({ success: false, message: 'This team is no longer accepting members' });
    }

    const existingRegistration = await Registration.findOne({
      event: team.event._id,
      user: req.user.id,
      status: { $ne: 'rejected' }
    });

    if (existingRegistration) {
      return res.status(400).json({ success: false, message: 'You are already registered for this event' });
    }

    const existingTeamMembership = await Team.findOne({
      event: team.event._id,
      members: req.user.id,
      status: { $ne: 'cancelled' }
    });
    if (existingTeamMembership && existingTeamMembership._id.toString() !== team._id.toString()) {
      return res.status(400).json({ success: false, message: 'You are already part of another team for this event' });
    }

    if (!team.members.some(memberId => memberId.toString() === req.user.id)) {
      team.members.push(req.user.id);
    }

    invite.status = 'accepted';
    invite.acceptedBy = req.user.id;
    invite.respondedAt = new Date();

    await team.save();

    const completion = await completeTeamIfReady(team, team.event);
    await team.populate('members', 'firstName lastName email');

    return res.status(200).json({
      success: true,
      message: completion.completed
        ? 'Invite accepted and team registration completed. Tickets issued to all members.'
        : 'Invite accepted successfully',
      data: {
        ...team.toObject(),
        inviteLinks: buildInviteLinks(team),
        completion
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove a pending invite
// @route   DELETE /api/registrations/team/:teamId/invites/:inviteId
// @access  Private (Participant leader)
exports.removeTeamInvite = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (team.leader.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only team leader can remove invites' });
    }

    const invite = team.invites.id(req.params.inviteId);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found' });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending invites can be removed' });
    }

    team.invites = team.invites.filter(existingInvite => existingInvite._id.toString() !== req.params.inviteId);
    await team.save();

    res.status(200).json({
      success: true,
      data: {
        ...team.toObject(),
        inviteLinks: buildInviteLinks(team)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get invite details by token
// @route   GET /api/registrations/team/invite/:token
// @access  Private (Participant)
exports.getInviteByToken = async (req, res, next) => {
  try {
    const team = await Team.findOne({ 'invites.token': req.params.token })
      .populate('event', 'title date endDate venue location')
      .populate('leader', 'firstName lastName email')
      .populate('members', 'firstName lastName email');

    if (!team) {
      return res.status(404).json({ success: false, message: 'Invite not found or expired' });
    }

    const invite = team.invites.find(existingInvite => existingInvite.token === req.params.token);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found or expired' });
    }

    res.status(200).json({
      success: true,
      data: {
        teamId: team._id,
        teamName: team.teamName,
        teamStatus: team.status,
        desiredTeamSize: team.desiredTeamSize,
        event: team.event,
        leader: team.leader,
        invite: {
          id: invite._id,
          email: invite.email,
          status: invite.status,
          respondedAt: invite.respondedAt
        },
        members: team.members,
        inviteTracking: (team.invites || []).map(existingInvite => ({
          email: existingInvite.email,
          status: existingInvite.status,
          respondedAt: existingInvite.respondedAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept team invite
// @route   PUT /api/registrations/team/invite/:token/accept
// @access  Private (Participant)
exports.acceptTeamInvite = async (req, res, next) => {
  try {
    const team = await Team.findOne({ 'invites.token': req.params.token })
      .populate('event')
      .populate('leader', 'firstName lastName email')
      .populate('members', 'firstName lastName email');

    if (!team) {
      return res.status(404).json({ success: false, message: 'Invite not found or expired' });
    }

    if (team.status !== 'forming') {
      return res.status(400).json({ success: false, message: 'This team is no longer accepting members' });
    }

    const invite = team.invites.find(existingInvite => existingInvite.token === req.params.token);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found or expired' });
    }

    if (invite.email !== req.user.email.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'This invite is for a different email address' });
    }

    if (invite.status === 'accepted') {
      return res.status(400).json({ success: false, message: 'Invite already accepted' });
    }

    const existingRegistration = await Registration.findOne({
      event: team.event._id,
      user: req.user.id,
      status: { $ne: 'rejected' }
    });

    if (existingRegistration) {
      return res.status(400).json({ success: false, message: 'You are already registered for this event' });
    }

    const existingTeamMembership = await Team.findOne({
      event: team.event._id,
      members: req.user.id,
      status: { $ne: 'cancelled' }
    });
    if (existingTeamMembership && existingTeamMembership._id.toString() !== team._id.toString()) {
      return res.status(400).json({ success: false, message: 'You are already part of another team for this event' });
    }

    if (!team.members.some(memberId => memberId.toString() === req.user.id)) {
      team.members.push(req.user.id);
    }

    invite.status = 'accepted';
    invite.acceptedBy = req.user.id;
    invite.respondedAt = new Date();

    await team.save();

    const completion = await completeTeamIfReady(team, team.event);
    await team.populate('members', 'firstName lastName email');

    res.status(200).json({
      success: true,
      message: completion.completed
        ? 'Invite accepted and team registration completed. Tickets issued to all members.'
        : 'Invite accepted successfully',
      data: {
        ...team.toObject(),
        inviteLinks: buildInviteLinks(team),
        completion
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Decline team invite
// @route   PUT /api/registrations/team/invite/:token/decline
// @access  Private (Participant)
exports.declineTeamInvite = async (req, res, next) => {
  try {
    const team = await Team.findOne({ 'invites.token': req.params.token });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Invite not found or expired' });
    }

    const invite = team.invites.find(existingInvite => existingInvite.token === req.params.token);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invite not found or expired' });
    }

    if (invite.email !== req.user.email.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'This invite is for a different email address' });
    }

    invite.status = 'declined';
    invite.respondedAt = new Date();
    await team.save();

    res.status(200).json({ success: true, message: 'Invite declined' });
  } catch (error) {
    next(error);
  }
};

// @desc    Register for an event
// @route   POST /api/registrations
// @access  Private (Participant)
exports.registerForEvent = async (req, res, next) => {
  try {
    const { eventId, teamName, teamMembers, customFields, teamLeader } = req.body;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if event is approved
    if (event.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot register for unapproved event'
      });
    }

    // Check registration deadline
    if (event.registrationDeadline && new Date(event.registrationDeadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline has passed'
      });
    }

    // Check eligibility
    const normalizedEligibility = normalizeEligibility(event.eligibility);
    if (normalizedEligibility === 'IIIT' && req.user.participantType !== 'IIIT') {
      return res.status(403).json({
        success: false,
        message: 'Only IIIT participants can register for this event'
      });
    }
    if (normalizedEligibility === 'Non-IIIT' && req.user.participantType === 'IIIT') {
      return res.status(403).json({
        success: false,
        message: 'Only external participants can register for this event'
      });
    }

    // Check if user already registered (non-merchandise only)
    if (event.type !== 'Merchandise') {
      const existingRegistration = await Registration.findOne({
        event: eventId,
        user: req.user.id,
        status: { $ne: 'rejected' }
      });

      if (existingRegistration) {
        return res.status(400).json({
          success: false,
          message: 'Already registered for this event'
        });
      }
    }

    // Check capacity
    const registrationCount = await Registration.countDocuments({
      event: eventId,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (registrationCount >= (event.capacity || event.maxParticipants)) {
      return res.status(400).json({
        success: false,
        message: 'Event is full'
      });
    }

    // Team validation
    const hasTeamMembers = Array.isArray(teamMembers) && teamMembers.length > 0;
    const isTeamRegistration = Boolean(teamName || hasTeamMembers || teamLeader);
    const participantMode =
      event.participantType === 'Both'
        ? 'Both'
        : event.participantType === 'Team' || event.allowTeams
          ? 'Team'
          : 'Individual';

    if (event.type === 'Merchandise' && isTeamRegistration) {
      return res.status(400).json({
        success: false,
        message: 'Merchandise purchases are individual only'
      });
    }

    if (participantMode === 'Team' && !isTeamRegistration) {
      return res.status(400).json({
        success: false,
        message: 'This event requires team registration'
      });
    }

    if (participantMode === 'Individual' && isTeamRegistration) {
      return res.status(400).json({
        success: false,
        message: 'This event supports individual registrations only'
      });
    }

    if (isTeamRegistration) {
      return res.status(400).json({
        success: false,
        message: 'Team registrations must use invite-based workflow. Create a team first and complete invite acceptance.'
      });
    }

    // Merchandise validation and pricing
    let merchandisePayload = null;
    // Prefer explicit registrationFee, fall back to legacy paymentAmount field if present
    let paymentAmount = Number(event.registrationFee || event.paymentAmount || 0);
    let paymentStatus = (paymentAmount > 0) ? 'pending' : 'free';
    let paymentApprovalStatus = paymentAmount > 0 ? 'pending' : 'not-required';
    let registrationStatus = (paymentAmount > 0) ? 'pending' : 'confirmed';

    if (event.type === 'Merchandise') {
      const payload = req.body.merchandise || {};
      const quantity = Math.max(1, Number(payload.quantity || req.body.quantity || 1));
      const purchaseLimit = event.merchandise?.purchaseLimit || 1;

      // Enforce per-participant purchase limit
      const previous = await Registration.find({ event: eventId, user: req.user.id });
      const purchased = previous.reduce((sum, reg) => sum + (reg.merchandise?.quantity || 0), 0);
      if (purchased + quantity > purchaseLimit) {
        return res.status(400).json({
          success: false,
          message: `Purchase limit is ${purchaseLimit} items per participant`
        });
      }

      let unitPrice = event.registrationFee || 0;
      let variantSku = payload.variantSku || null;
      let size = payload.size || null;
      let color = payload.color || null;

      if (event.merchandise?.variants?.length) {
        const variant = event.merchandise.variants.find(v =>
          (variantSku && v.sku === variantSku) ||
          (!variantSku && v.size === size && v.color === color)
        );

        if (!variant) {
          return res.status(400).json({
            success: false,
            message: 'Selected variant not available'
          });
        }

        if (variant.stock < quantity) {
          return res.status(400).json({
            success: false,
            message: 'Selected variant is out of stock'
          });
        }

        variantSku = variant.sku || variantSku;
        size = variant.size || size;
        color = variant.color || color;
        unitPrice = variant.price || unitPrice;

      } else if (event.merchandise) {
        if ((event.merchandise.stock || 0) < quantity) {
          return res.status(400).json({
            success: false,
            message: 'Item is out of stock'
          });
        }
      }

      paymentAmount = unitPrice * quantity;
      paymentStatus = paymentAmount > 0 ? 'pending' : 'free';
      paymentApprovalStatus = paymentAmount > 0 ? 'awaiting-proof' : 'not-required';
      registrationStatus = paymentAmount > 0 ? 'pending' : 'confirmed';

      merchandisePayload = {
        size,
        color,
        variantSku,
        quantity,
        unitPrice,
        totalPrice: paymentAmount
      };
    }

    // Create registration
    const registration = await Registration.create({
      event: eventId,
      user: req.user.id,
      participantName: `${req.user.firstName} ${req.user.lastName}`.trim(),
      email: req.user.email,
      isTeam: isTeamRegistration,
      teamName,
      teamLeader,
      teamMembers,
      customFieldResponses: customFields,
      merchandise: merchandisePayload,
      paymentAmount,
      paymentStatus,
      paymentApprovalStatus,
      amountPaid: paymentStatus === 'paid' ? paymentAmount : 0,
      status: registrationStatus
    });

    // Update registered count on the event
    event.registered = (event.registered || 0) + 1;
    await event.save();

    await registration.populate('event', 'title date venue');

    let issued = registration;
    const shouldIssueTicket =
      event.type === 'Merchandise'
        ? paymentApprovalStatus === 'approved' || paymentStatus === 'free'
        : ['paid', 'free'].includes(paymentStatus);
    if (shouldIssueTicket) {
      issued = await issueTicket(registration, event);
    }

    res.status(201).json({
      success: true,
      data: issued
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my registrations
// @route   GET /api/registrations/my-registrations
// @access  Private (Participant)
exports.getMyRegistrations = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ user: req.user.id })
      .populate('event', 'title date venue organizer category fees')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single registration
// @route   GET /api/registrations/:id
// @access  Private (Owner or Organizer/Admin)
exports.getRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id)
      .populate('user', 'firstName lastName email contactNumber')
      .populate('event', 'title date venue organizer');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check authorization
    if (
      registration.user._id.toString() !== req.user.id &&
      registration.event.organizer.toString() !== req.user.id &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this registration'
      });
    }

    res.status(200).json({
      success: true,
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get registrations for an event
// @route   GET /api/registrations/event/:eventId
// @access  Private (Organizer/Admin)
exports.getEventRegistrations = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check authorization
    if (event.organizer.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view event registrations'
      });
    }

    const registrations = await Registration.find({ event: req.params.eventId })
      .populate('user', 'firstName lastName email contactNumber participantType')
      .sort('-createdAt');

    const stats = {
      total: registrations.length,
      confirmed: registrations.filter(r => r.status === 'confirmed').length,
      pending: registrations.filter(r => r.status === 'pending').length,
      cancelled: registrations.filter(r => r.status === 'rejected').length,
      checkedIn: registrations.filter(r => r.checkedIn).length,
      paymentPending: registrations.filter(r => r.paymentStatus === 'pending').length,
      paymentCompleted: registrations.filter(r => r.paymentStatus === 'paid').length
    };

    res.status(200).json({
      success: true,
      count: registrations.length,
      stats,
      data: registrations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel registration
// @route   PUT /api/registrations/:id/cancel
// @access  Private (Owner)
exports.cancelRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check if user owns this registration
    if (registration.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this registration'
      });
    }

    // Check if already cancelled
    if (registration.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Registration already cancelled'
      });
    }

    // Check if event has already happened
    const event = await Event.findById(registration.event);
    if (new Date(event.date) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel registration for past events'
      });
    }

    if (registration.status !== 'rejected') {
      await Event.findByIdAndUpdate(registration.event, { $inc: { registered: -1 } });
    }

    registration.status = 'rejected';
    await registration.save();

    res.status(200).json({
      success: true,
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update payment status
// @route   PUT /api/registrations/:id/payment
// @access  Private (Organizer/Admin)
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus, paymentMethod, transactionId, amountPaid, paymentApprovalStatus } = req.body;

    if (!['pending', 'paid', 'failed', 'free', 'refunded'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    if (paymentApprovalStatus && !['awaiting-proof', 'pending', 'approved', 'rejected', 'not-required'].includes(paymentApprovalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment approval status'
      });
    }

    const registration = await Registration.findById(req.params.id).populate('event');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check authorization
    if (
      registration.event.organizer.toString() !== req.user.id &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update payment status'
      });
    }

    if (
      registration.event.type === 'Merchandise' &&
      (paymentStatus === 'paid' || paymentApprovalStatus === 'approved') &&
      !registration.paymentScreenshot
    ) {
      return res.status(400).json({
        success: false,
        message: 'Payment proof is required before approving merchandise payments'
      });
    }

    const previousPaymentStatus = registration.paymentStatus;
    const previousApprovalStatus = registration.paymentApprovalStatus;
    registration.paymentStatus = paymentStatus;
    if (paymentApprovalStatus) {
      registration.paymentApprovalStatus = paymentApprovalStatus;
    }
    
    if (paymentMethod) registration.paymentMethod = paymentMethod;
    if (transactionId) registration.transactionId = transactionId;
    if (amountPaid !== undefined) registration.amountPaid = amountPaid;

    // Map payment status to approval status for merchandise
    if (registration.event.type === 'Merchandise' && !paymentApprovalStatus) {
      if (paymentStatus === 'paid') registration.paymentApprovalStatus = 'approved';
      if (paymentStatus === 'failed') registration.paymentApprovalStatus = 'rejected';
      if (paymentStatus === 'pending') registration.paymentApprovalStatus = 'pending';
    }

    // Update registration status if payment completed
    if (paymentStatus === 'paid' && registration.status === 'pending') {
      registration.status = 'confirmed';
      // Default amountPaid to expected paymentAmount when not provided
      if (registration.amountPaid === 0) {
        registration.amountPaid = registration.paymentAmount || 0;
      }
    }

    if (paymentStatus === 'failed' && registration.event.type === 'Merchandise') {
      registration.status = 'pending';
    }

    if (registration.event.type === 'Merchandise' && registration.paymentApprovalStatus === 'approved' && previousApprovalStatus !== 'approved') {
      const quantity = registration.merchandise?.quantity || 1;
      if (registration.merchandise?.variantSku && registration.event.merchandise?.variants?.length) {
        const variant = registration.event.merchandise.variants.find(v => v.sku === registration.merchandise.variantSku);
        if (!variant || (variant.stock || 0) < quantity) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient stock for selected variant'
          });
        }
        variant.stock -= quantity;
      } else {
        const currentStock = registration.event.merchandise?.stock || 0;
        if (currentStock < quantity) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient stock for this item'
          });
        }
        registration.event.merchandise.stock = currentStock - quantity;
      }

      await registration.event.save();
    }

    await registration.save();

    const shouldIssueForMerchandise = registration.event.type !== 'Merchandise'
      || registration.paymentApprovalStatus === 'approved'
      || paymentStatus === 'free';

    if (paymentStatus === 'paid' && previousPaymentStatus !== 'paid' && shouldIssueForMerchandise) {
      await issueTicket(registration, registration.event, { forceEmail: true });
    }

    res.status(200).json({
      success: true,
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend ticket email
// @route   PUT /api/registrations/:id/resend-ticket
// @access  Private (Owner or Organizer/Admin)
exports.resendTicketEmail = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id)
      .populate('event', 'title date venue organizer');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    const isOwner = registration.user.toString() === req.user.id;
    const isOrganizer = registration.event?.organizer?.toString() === req.user.id;
    const isAdmin = req.user.role === 'Admin';

    if (!isOwner && !isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to resend this ticket'
      });
    }

    if (
      registration.event?.type === 'Merchandise' &&
      registration.paymentStatus !== 'free' &&
      registration.paymentApprovalStatus !== 'approved'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Ticket can be sent only after merchandise payment approval'
      });
    }

    await issueTicket(registration, registration.event, { forceEmail: true });

    res.status(200).json({
      success: true,
      message: 'Ticket email sent successfully',
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check-in participant
// @route   PUT /api/registrations/:id/checkin
// @access  Private (Organizer/Admin)
exports.checkInParticipant = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id).populate('event');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check authorization
    if (
      registration.event.organizer.toString() !== req.user.id &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to check-in participants'
      });
    }

    // Check if registration is confirmed
    if (registration.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Can only check-in confirmed registrations'
      });
    }

    // Check if already checked in
    if (registration.checkedIn) {
      return res.status(400).json({
        success: false,
        message: 'Participant already checked in',
        checkInTime: registration.checkInTime
      });
    }

    registration.checkedIn = true;
    registration.checkInTime = new Date();
    await registration.save();

    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get registration statistics
// @route   GET /api/registrations/stats/overview
// @access  Private (Admin)
exports.getRegistrationStats = async (req, res, next) => {
  try {
    const totalRegistrations = await Registration.countDocuments();
    const confirmedRegistrations = await Registration.countDocuments({ status: 'confirmed' });
    const pendingRegistrations = await Registration.countDocuments({ status: 'pending' });
    const cancelledRegistrations = await Registration.countDocuments({ status: 'rejected' });
    const checkedInRegistrations = await Registration.countDocuments({ checkedIn: true });

    const paymentStats = await Registration.aggregate([
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amountPaid' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalRegistrations,
        confirmed: confirmedRegistrations,
        pending: pendingRegistrations,
        cancelled: cancelledRegistrations,
        checkedIn: checkedInRegistrations,
        payments: paymentStats
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all registrations for organizer's events
// @route   GET /api/registrations/organizer/my-registrations
// @access  Private (Organizer)
exports.getOrganizerRegistrations = async (req, res, next) => {
  try {
    // Fetch events owned by organizer
    const events = await Event.find({ organizer: req.user.id }).select('_id title');
    const eventIds = events.map(e => e._id);

    const regs = await Registration.find({ event: { $in: eventIds } })
      .populate('user', 'firstName lastName email contactNumber')
      .populate('event', 'title date venue');

    res.status(200).json({
      success: true,
      count: regs.length,
      data: regs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update registration status
// @route   PUT /api/registrations/:id/status
// @access  Private (Owner or Organizer/Admin)
exports.updateRegistrationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'rejected', 'approved'];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    const event = await Event.findById(registration.event);

    // Check authorization
    if (
      registration.user.toString() !== req.user.id &&
      event?.organizer?.toString() !== req.user.id &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this registration'
      });
    }

    const previousStatus = registration.status;

    if (
      event?.type === 'Merchandise' &&
      (status === 'confirmed' || status === 'approved') &&
      registration.paymentStatus !== 'free' &&
      registration.paymentApprovalStatus !== 'approved'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Merchandise order can be confirmed only after payment approval'
      });
    }

    registration.status = status;
    await registration.save();

    if (previousStatus !== 'rejected' && status === 'rejected') {
      await Event.findByIdAndUpdate(registration.event, { $inc: { registered: -1 } });
    }
    if (previousStatus === 'rejected' && status !== 'rejected') {
      await Event.findByIdAndUpdate(registration.event, { $inc: { registered: 1 } });
    }

    if (
      (status === 'confirmed' || status === 'approved') &&
      !registration.ticketQr &&
      (event?.type !== 'Merchandise' || registration.paymentStatus === 'free' || registration.paymentApprovalStatus === 'approved')
    ) {
      await issueTicket(registration, event);
    }

    res.status(200).json({
      success: true,
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload payment proof
// @route   POST /api/registrations/:id/payment-proof
// @access  Private (Owner)
exports.uploadPaymentProof = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Payment proof image is required'
      });
    }

    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload payment proof'
      });
    }

    if (registration.paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment proof is not required for free registrations'
      });
    }

    registration.paymentScreenshot = `/uploads/${req.file.filename}`;
    if (registration.paymentStatus === 'pending' || registration.paymentStatus === 'failed') {
      registration.paymentStatus = 'pending';
    }
    if (registration.paymentAmount > 0) {
      registration.paymentApprovalStatus = 'pending';
    }

    await registration.save();

    res.status(200).json({
      success: true,
      data: registration
    });
  } catch (error) {
    next(error);
  }
};
