const User = require('../models/User');
const Club = require('../models/Club');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const { sendTokenResponse } = require('../utils/auth');
const { isIIITEmail } = require('../utils/validators');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, participantType, college, contactNumber } = req.body;

    // Validation for IIIT participants
    if (participantType === 'IIIT' && !isIIITEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'IIIT participants must use a valid IIIT email (@iiit.ac.in, @students.iiit.ac.in or @research.iiit.ac.in)'
      });
    }

    // Only participants can self-register
    if (role && role !== 'Participant') {
      return res.status(400).json({
        success: false,
        message: 'Only participants can self-register'
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'Participant',
      participantType,
      college: participantType === 'IIIT' ? 'IIIT Hyderabad' : college,
      contactNumber
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact admin.'
      });
    }

    // For organizers linked to a club, ensure the club is still active
    if (user.role === 'Organizer' && user.clubId) {
      const club = await Club.findById(user.clubId).select('isActive name');
      if (!club || club.isActive === false) {
        return res.status(401).json({
          success: false,
          message: 'Your club has been archived. Please contact an admin to restore access.'
        });
      }
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('clubId')
      .populate('preferences.followedClubs', 'name category contact');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/updateprofile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const existingUser = await User.findById(req.user.id).select('preferences organizerProfile role participantType');
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const fieldsToUpdate = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      contactNumber: req.body.contactNumber
    };

    // Participant preferences
    if (Array.isArray(req.body.interests)) {
      fieldsToUpdate['preferences.interests'] = req.body.interests;
    }
    if (Array.isArray(req.body.followedClubs)) {
      const previousFollowed = (existingUser.preferences?.followedClubs || []).map(clubId => clubId.toString());
      const nextFollowed = [...new Set(req.body.followedClubs.map(clubId => clubId.toString()))];

      const clubsToAdd = nextFollowed.filter(clubId => !previousFollowed.includes(clubId));
      const clubsToRemove = previousFollowed.filter(clubId => !nextFollowed.includes(clubId));

      if (clubsToAdd.length > 0) {
        await Club.updateMany(
          { _id: { $in: clubsToAdd } },
          { $addToSet: { members: existingUser._id } }
        );
      }

      if (clubsToRemove.length > 0) {
        await Club.updateMany(
          { _id: { $in: clubsToRemove } },
          { $pull: { members: existingUser._id } }
        );
      }

      fieldsToUpdate['preferences.followedClubs'] = nextFollowed;
    }

    // Don't allow updating college for IIIT participants
    if (req.user.participantType !== 'IIIT' && req.body.college) {
      fieldsToUpdate.college = req.body.college;
    }

    // Organizer profile updates (only for organizer role)
    if (req.user.role === 'Organizer' && req.body.organizerProfile) {
      const { name, category, description, contactEmail, contactNumber, discordWebhook } = req.body.organizerProfile;
      fieldsToUpdate.organizerProfile = {
        ...(existingUser.organizerProfile || {}),
        ...(name && { name }),
        ...(category && { category }),
        ...(description && { description }),
        ...(contactEmail && { contactEmail }),
        ...(contactNumber && { contactNumber }),
        ...(discordWebhook && { discordWebhook })
      };
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    }).populate('preferences.followedClubs', 'name category contact');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private (Participants and Admins only - Organizers must request password reset from Admin)
exports.updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Organizers cannot self-reset passwords - must request from Admin
    if (user.role === 'Organizer') {
      return res.status(403).json({
        success: false,
        message: 'Organizers cannot change their own password. Please contact Admin for password reset.'
      });
    }

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Organizer requests password reset from Admin
// @route   POST /api/auth/organizer/password-reset-request
// @access  Private (Organizer)
exports.requestOrganizerPasswordReset = async (req, res, next) => {
  try {
    if (req.user.role !== 'Organizer') {
      return res.status(403).json({
        success: false,
        message: 'Only organizers can request organizer password reset'
      });
    }

    const reason = String(req.body.reason || '').trim();
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    const pendingRequest = await PasswordResetRequest.findOne({
      organizer: req.user.id,
      status: 'Pending'
    });

    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending password reset request'
      });
    }

    const request = await PasswordResetRequest.create({
      organizer: req.user.id,
      reason,
      history: [
        {
          fromStatus: 'Pending',
          toStatus: 'Pending',
          comment: 'Request created',
          changedBy: req.user.id,
          changedAt: new Date()
        }
      ]
    });

    const populated = await PasswordResetRequest.findById(request._id)
      .populate('organizer', 'firstName lastName email organizerProfile clubId')
      .populate('organizer.clubId', 'name')
      .populate('resolvedBy', 'firstName lastName email')
      .populate('history.changedBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Password reset request submitted to admin',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get organizer's password reset request history
// @route   GET /api/auth/organizer/password-reset-requests
// @access  Private (Organizer)
exports.getMyOrganizerPasswordResetRequests = async (req, res, next) => {
  try {
    if (req.user.role !== 'Organizer') {
      return res.status(403).json({
        success: false,
        message: 'Only organizers can view organizer password reset requests'
      });
    }

    const requests = await PasswordResetRequest.find({ organizer: req.user.id })
      .populate('organizer', 'firstName lastName email organizerProfile clubId')
      .populate('organizer.clubId', 'name')
      .populate('resolvedBy', 'firstName lastName email')
      .populate('history.changedBy', 'firstName lastName email')
      .sort('-requestedAt');

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    next(error);
  }
};
