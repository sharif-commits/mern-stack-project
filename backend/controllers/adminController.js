const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Club = require('../models/Club');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const { sendOrganizerProvisionMail, sendOrganizerResetMail } = require('../utils/mailer');
const { generatePassword, generateOrganizerEmail } = require('../utils/organizerCredentials');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin only)
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};
    
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/admin/users/:id
// @access  Private (Admin only)
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's registrations count
    const registrationCount = await Registration.countDocuments({ user: req.params.id });
    
    // If organizer, get events count
    let eventCount = 0;
    if (user.role === 'Organizer') {
      eventCount = await Event.countDocuments({ organizer: req.params.id });
    }

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        registrationCount,
        eventCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private (Admin only)
exports.updateUser = async (req, res, next) => {
  try {
    const { password, ...updateData } = req.body;

    // Don't allow password update through this route
    if (password) {
      return res.status(400).json({
        success: false,
        message: 'Use password update endpoint to change password'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/Deactivate user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    if (req.query.permanent === 'true') {
      await user.deleteOne();
    } else {
      // Soft delete - deactivate user
      user.isActive = false;
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Promote user to organizer (DEPRECATED - Use createOrganizer instead)
// @route   PUT /api/admin/users/:id/promote
// @access  Private (Admin only)
// @note    This endpoint violates the requirement that "Organizer accounts are provisioned by Admin"
//          Organizers should be created fresh using POST /api/admin/organizers, not promoted from participants
exports.promoteToOrganizer = async (req, res, next) => {
  try {
    // This functionality is disabled per assignment requirements
    // Organizer accounts must be provisioned (created fresh), not promoted from existing participants
    return res.status(403).json({
      success: false,
      message: 'Promoting participants to organizers is not allowed. Use POST /api/admin/organizers to create new organizer accounts.'
    });

    /* DISABLED CODE - Keep for reference but do not use
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'Participant') {
      return res.status(400).json({
        success: false,
        message: 'Can only promote participants to organizers'
      });
    }

    user.role = 'Organizer';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User promoted to Organizer',
      data: user
    });
    */
  } catch (error) {
    next(error);
  }
};

// @desc    Get system statistics
// @route   GET /api/admin/stats
// @access  Private (Admin only)
exports.getSystemStats = async (req, res, next) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Event statistics
    const totalEvents = await Event.countDocuments();
    const eventsByStatus = await Event.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const upcomingEvents = await Event.countDocuments({
      status: 'approved',
      date: { $gte: new Date() }
    });

    // Registration statistics
    const totalRegistrations = await Registration.countDocuments();
    const confirmedRegistrations = await Registration.countDocuments({ 
      status: 'confirmed' 
    });
    const registrationsByStatus = await Registration.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Payment statistics
    const paymentStats = await Registration.aggregate([
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amountPaid' }
        }
      }
    ]);

    // Club statistics
    const totalClubs = await Club.countDocuments({ isActive: true });

    // Recent activity
    const recentUsers = await User.find()
      .select('firstName lastName email role createdAt')
      .sort('-createdAt')
      .limit(5);

    const recentEvents = await Event.find()
      .select('title date status organizer')
      .populate('organizer', 'firstName lastName')
      .sort('-createdAt')
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          byRole: usersByRole
        },
        events: {
          total: totalEvents,
          byStatus: eventsByStatus,
          upcoming: upcomingEvents
        },
        registrations: {
          total: totalRegistrations,
          confirmed: confirmedRegistrations,
          byStatus: registrationsByStatus
        },
        payments: paymentStats,
        clubs: totalClubs,
        recentActivity: {
          users: recentUsers,
          events: recentEvents
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all events (admin only)
// @route   GET /api/admin/events
// @access  Private (Admin only)
exports.getAllEvents = async (req, res, next) => {
  try {
    const events = await Event.find()
      .populate('organizer', 'firstName lastName email')
      .populate('clubId', 'name')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending events for approval
// @route   GET /api/admin/pending-events
// @access  Private (Admin only)
exports.getPendingEvents = async (req, res, next) => {
  try {
    const pendingEvents = await Event.find({ status: 'pending' })
      .populate('organizer', 'firstName lastName email')
      .populate('clubId', 'name')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: pendingEvents.length,
      data: pendingEvents
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all clubs (admin only)
// @route   GET /api/admin/clubs
// @access  Private (Admin only)
exports.getAllClubs = async (req, res, next) => {
  try {
    const clubs = await Club.find()
      .populate('headCoordinator', 'firstName lastName email')
      .populate('members', 'firstName lastName email')
      .populate('organizers', 'firstName lastName email')
      .sort('name');

    res.status(200).json({
      success: true,
      count: clubs.length,
      data: clubs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create an organizer account (admin provisioned)
// @route   POST /api/admin/organizers
// @access  Private (Admin only)
// @note    This is the ONLY way to create organizer accounts per assignment requirements
//          - No self-registration for organizers
//          - Admin creates account and provides credentials to organizer
//          - Generated password is returned to admin to share with organizer
exports.createOrganizer = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      contactNumber,
      organizerName,
      category,
      description,
      contactEmail,
      contactPhone,
      discordWebhook
    } = req.body;

    const trimmedEmail = (email || '').trim();
    let finalEmail = trimmedEmail ? trimmedEmail.toLowerCase() : '';
    if (!finalEmail) {
      const base = organizerName || `${firstName} ${lastName}`;
      finalEmail = await generateOrganizerEmail(base);
    }

    // Basic uniqueness check
    const existing = await User.findOne({ email: finalEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    // Generate secure random password
    const password = generatePassword();

    const user = await User.create({
      firstName,
      lastName,
      email: finalEmail,
      contactNumber,
      role: 'Organizer',
      password,
      organizerProfile: {
        name: organizerName || `${firstName} ${lastName}`,
        category,
        description,
        contactEmail: contactEmail || finalEmail,
        contactNumber: contactPhone || contactNumber,
        discordWebhook
      }
    });

    await sendOrganizerProvisionMail({
      to: user.email,
      organizerName: user.organizerProfile?.name || `${user.firstName} ${user.lastName}`.trim(),
      password
    });

    res.status(201).json({
      success: true,
      message: 'Organizer account created successfully. Share these credentials with the organizer.',
      data: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        organizerProfile: user.organizerProfile
      },
      credentials: {
        email: user.email,
        password,
        note: 'Share these credentials securely with the organizer. They cannot be retrieved later.'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get organizer password reset requests
// @route   GET /api/admin/password-reset-requests
// @access  Private (Admin)
exports.getOrganizerPasswordResetRequests = async (req, res, next) => {
  try {
    const { status = 'all' } = req.query;

    const query = {};
    if (status !== 'all') {
      query.status = status;
    }

    const requests = await PasswordResetRequest.find(query)
      .populate('organizer', 'firstName lastName email organizerProfile clubId')
      .populate('organizer.clubId', 'name')
      .populate('resolvedBy', 'firstName lastName email')
      .populate('history.changedBy', 'firstName lastName email')
      .sort('-requestedAt');

    const data = requests.map((request) => {
      const organizer = request.organizer || {};
      const clubName = organizer.clubId?.name || organizer.organizerProfile?.name || 'N/A';
      return {
        ...request.toObject(),
        organizerMeta: {
          clubName,
          organizerName: `${organizer.firstName || ''} ${organizer.lastName || ''}`.trim(),
          organizerEmail: organizer.email || ''
        }
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Review organizer password reset request (approve/reject)
// @route   PUT /api/admin/password-reset-requests/:id/review
// @access  Private (Admin)
exports.reviewOrganizerPasswordResetRequest = async (req, res, next) => {
  try {
    const { action, comment = '' } = req.body;
    const normalizedAction = String(action || '').trim().toLowerCase();

    if (!['approve', 'reject'].includes(normalizedAction)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be approve or reject'
      });
    }

    const request = await PasswordResetRequest.findById(req.params.id)
      .populate('organizer', 'firstName lastName email organizerProfile');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Password reset request not found'
      });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Request already ${request.status.toLowerCase()}`
      });
    }

    const previousStatus = request.status;
    request.adminComment = String(comment || '').trim();
    request.resolvedBy = req.user.id;
    request.resolvedAt = new Date();

    let credentials = null;

    if (normalizedAction === 'approve') {
      const user = await User.findById(request.organizer._id).select('+password');
      if (!user || user.role !== 'Organizer') {
        return res.status(400).json({
          success: false,
          message: 'Associated organizer account not found'
        });
      }

      const password = generatePassword();
      user.password = password;
      await user.save();

      await sendOrganizerResetMail({
        to: user.email,
        organizerName: user.organizerProfile?.name || `${user.firstName} ${user.lastName}`.trim(),
        password
      });

      request.generatedPassword = password;
      request.status = 'Approved';
      credentials = {
        email: user.email,
        password
      };
    } else {
      request.generatedPassword = '';
      request.status = 'Rejected';
    }

    request.history.push({
      fromStatus: previousStatus,
      toStatus: request.status,
      comment: request.adminComment,
      changedBy: req.user.id,
      changedAt: new Date()
    });

    await request.save();

    const updated = await PasswordResetRequest.findById(request._id)
      .populate('organizer', 'firstName lastName email organizerProfile clubId')
      .populate('organizer.clubId', 'name')
      .populate('resolvedBy', 'firstName lastName email')
      .populate('history.changedBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      message: normalizedAction === 'approve'
        ? 'Password reset request approved and new password generated'
        : 'Password reset request rejected',
      data: updated,
      credentials
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset organizer password (admin only)
// @route   PUT /api/admin/users/:id/reset-password
// @access  Private (Admin only)
// @note    This is the ONLY way for organizers to reset their password
//          Organizers must request password reset through admin (email, support ticket, etc.)
//          Organizers CANNOT use the /api/auth/updatepassword endpoint
exports.resetOrganizerPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'Organizer') {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for organizer password resets. Participants can use /api/auth/updatepassword'
      });
    }

    // Generate new random password
    const password = generatePassword();
    user.password = password;
    await user.save();

    await sendOrganizerResetMail({
      to: user.email,
      organizerName: user.organizerProfile?.name || `${user.firstName} ${user.lastName}`.trim(),
      password
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successful. New credentials generated.',
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      credentials: {
        email: user.email,
        password
      }
    });
  } catch (error) {
    next(error);
  }
};
