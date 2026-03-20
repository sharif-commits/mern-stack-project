const Club = require('../models/Club');
const User = require('../models/User');
const Event = require('../models/Event');
const { generatePassword, generateOrganizerEmail } = require('../utils/organizerCredentials');
const { sendOrganizerProvisionMail } = require('../utils/mailer');

// @desc    Create a new club and a system-generated organizer account (head coordinator)
// @route   POST /api/clubs
// @access  Private (Admin)
exports.createClub = async (req, res, next) => {
  try {
    const club = await Club.create(req.body);

    // Create organizer account for this club with system-generated email and password
    const email = await generateOrganizerEmail(club.name);
    const password = generatePassword();
    const presidentParts = (club.president || '').trim().split(/\s+/);
    const firstName = presidentParts[0] || 'Club';
    const lastName = presidentParts.slice(1).join(' ') || 'Head';

    const organizer = await User.create({
      firstName,
      lastName,
      email,
      contactNumber: club.contact?.phone || '',
      role: 'Organizer',
      password,
      clubId: club._id,
      organizerProfile: {
        name: club.name,
        category: club.category,
        description: club.description,
        contactEmail: club.contact?.email || email,
        contactNumber: club.contact?.phone || ''
      }
    });

    club.headCoordinator = organizer._id;
    club.organizers = [organizer._id];
    await club.save();

    await sendOrganizerProvisionMail({
      to: organizer.email,
      organizerName: club.name,
      password
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Club created. Share the credentials below with the club head.',
      data: club,
      credentials: {
        email: organizer.email,
        password,
        note: 'Share these credentials securely with the club head. They cannot be retrieved later.'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all clubs
// @route   GET /api/clubs
// @access  Public
exports.getClubs = async (req, res, next) => {
  try {
    const clubs = await Club.find({ isActive: true })
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

// @desc    Get single club
// @route   GET /api/clubs/:id
// @access  Public
exports.getClub = async (req, res, next) => {
  try {
    const club = await Club.findById(req.params.id)
      .populate('headCoordinator', 'firstName lastName email contactNumber')
      .populate('members', 'firstName lastName email')
      .populate('organizers', 'firstName lastName email');

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found'
      });
    }

    // Get club's events
    const events = await Event.find({ clubId: req.params.id })
      .sort('-date')
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        ...club.toObject(),
        recentEvents: events
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update club
// @route   PUT /api/clubs/:id
// @access  Private (Admin or Club Head)
exports.updateClub = async (req, res, next) => {
  try {
    let club = await Club.findById(req.params.id);

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found'
      });
    }

    // Check authorization (Admin or Club Head Coordinator)
    const isHeadCoordinator = club.headCoordinator && club.headCoordinator.toString() === req.user.id;
    const isOrganizer = club.organizers && club.organizers.some(org => org.toString() === req.user.id);
    
    if (req.user.role !== 'Admin' && !isHeadCoordinator && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this club'
      });
    }

    club = await Club.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: club
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete club
// @route   DELETE /api/clubs/:id
// @access  Private (Admin only)
exports.deleteClub = async (req, res, next) => {
  try {
    const club = await Club.findById(req.params.id);

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found'
      });
    }

    if (req.query.permanent === 'true') {
      await club.deleteOne();
    } else {
      // Soft delete - set isActive to false
      club.isActive = false;
      await club.save();
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add member to club
// @route   POST /api/clubs/:id/members
// @access  Private (Admin or Club Head)
exports.addMember = async (req, res, next) => {
  try {
    const { userId } = req.body;

    const club = await Club.findById(req.params.id);

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found'
      });
    }

    // Check authorization
    const isHeadCoordinator = club.headCoordinator && club.headCoordinator.toString() === req.user.id;
    const isOrganizer = club.organizers && club.organizers.some(org => org.toString() === req.user.id);
    
    if (req.user.role !== 'Admin' && !isHeadCoordinator && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add members to this club'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already a member
    if (club.members.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member'
      });
    }

    club.members.push(userId);
    await club.save();

    await club.populate('members', 'firstName lastName email');

    res.status(200).json({
      success: true,
      data: club
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from club
// @route   DELETE /api/clubs/:id/members/:userId
// @access  Private (Admin or Club Head)
exports.removeMember = async (req, res, next) => {
  try {
    const club = await Club.findById(req.params.id);

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found'
      });
    }

    // Check authorization
    const isHeadCoordinator = club.headCoordinator && club.headCoordinator.toString() === req.user.id;
    const isOrganizer = club.organizers && club.organizers.some(org => org.toString() === req.user.id);
    
    if (req.user.role !== 'Admin' && !isHeadCoordinator && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove members from this club'
      });
    }

    // Cannot remove head coordinator
    if (club.headCoordinator && club.headCoordinator.toString() === req.params.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove head coordinator'
      });
    }

    // Remove member
    club.members = club.members.filter(
      member => member.toString() !== req.params.userId
    );

    await club.save();

    res.status(200).json({
      success: true,
      data: club
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get club statistics
// @route   GET /api/clubs/:id/stats
// @access  Private (Admin or Club Head)
exports.getClubStats = async (req, res, next) => {
  try {
    const club = await Club.findById(req.params.id);

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found'
      });
    }

    // Check authorization - use headCoordinator if available, otherwise check organizers
    const isHeadCoordinator = club.headCoordinator && club.headCoordinator.toString() === req.user.id;
    const isOrganizer = club.organizers && club.organizers.some(org => org.toString() === req.user.id);
    
    if (req.user.role !== 'Admin' && !isHeadCoordinator && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view club statistics'
      });
    }

    // Get event statistics
    const totalEvents = await Event.countDocuments({ clubId: req.params.id });
    const approvedEvents = await Event.countDocuments({ 
      clubId: req.params.id, 
      status: 'approved' 
    });
    const upcomingEvents = await Event.countDocuments({
      clubId: req.params.id,
      status: 'approved',
      date: { $gte: new Date() }
    });

    const stats = {
      clubName: club.name,
      memberCount: club.members.length,
      totalEvents,
      approvedEvents,
      upcomingEvents,
      foundedDate: club.createdAt
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};
