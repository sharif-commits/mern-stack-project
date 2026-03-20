const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const { postEventToDiscord } = require('../utils/discord');
const { normalizeEligibility } = require('../utils/eligibility');

const getEligibilityAliases = (eligibility) => {
  const normalized = normalizeEligibility(eligibility);

  if (normalized === 'All') {
    return ['All', 'Both', 'IIIT+External', 'IIIT & External', 'IIIT and External'];
  }

  if (normalized === 'IIIT') {
    return ['IIIT', 'IIIT Only'];
  }

  return ['Non-IIIT', 'External', 'External Only', 'Non-IIIT Only'];
};

const computeLifecycleStatus = (event) => {
  if (event.isClosed) return 'closed';
  if (event.status === 'draft' || event.lifecycleStatus === 'draft') return 'draft';
  const now = new Date();
  if (event.endDate && now > new Date(event.endDate)) return 'completed';
  if (event.date && event.endDate) {
    const start = new Date(event.date);
    const end = new Date(event.endDate);
    if (now >= start && now <= end) return 'ongoing';
  }
  return 'published';
};

const applyLifecycleStatus = (event) => {
  const computed = computeLifecycleStatus(event);
  if (event.lifecycleStatus !== computed && computed !== 'draft') {
    event.lifecycleStatus = computed;
  }
  return event;
};

// @desc    Create a new event
// @route   POST /api/events
// @access  Private (Organizer only)
exports.createEvent = async (req, res, next) => {
  try {
    // Add organizer to req.body
    req.body.organizer = req.user.id;
    const publishNow = Boolean(req.body.publishNow);

    if (publishNow) {
      req.body.status = 'approved';
      req.body.lifecycleStatus = 'published';
    } else {
      req.body.status = 'draft';
      req.body.lifecycleStatus = 'draft';
    }
    // Ensure organizerName is set from user profile if not provided
    if (!req.body.organizerName && req.user) {
      const name = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
      req.body.organizerName = name || req.user.email;
    }

    if (req.body.date && req.body.endDate) {
      const start = new Date(req.body.date);
      const end = new Date(req.body.endDate);
      if (end < start) {
        return res.status(400).json({
          success: false,
          message: 'Event end date must be on or after the start date'
        });
      }
    }

    if (req.body.registrationDeadline && req.body.date) {
      const deadline = new Date(req.body.registrationDeadline);
      const start = new Date(req.body.date);
      if (deadline > start) {
        return res.status(400).json({
          success: false,
          message: 'Registration deadline must be before the event start date'
        });
      }
    }

    if (req.body.type === 'Merchandise') {
      if (!req.body.merchandise || (!req.body.merchandise.stock && !req.body.merchandise.variants)) {
        return res.status(400).json({
          success: false,
          message: 'Merchandise details and stock are required'
        });
      }
    }

    const event = await Event.create(req.body);

    // If published immediately, auto-post to organizer's Discord webhook
    if (publishNow && event.organizer) {
      const organizer = await User.findById(event.organizer).select('organizerProfile');
      const webhookUrl = organizer?.organizerProfile?.discordWebhook;
      postEventToDiscord(event, webhookUrl);
    }

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all events
// @route   GET /api/events
// @access  Public
exports.getEvents = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude from filtering
    const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
    removeFields.forEach(param => delete reqQuery[param]);

    // Build query object
    let queryObj = {};

    // Search functionality
    if (req.query.search) {
      const raw = req.query.search.trim();
      const fuzzy = raw.split('').join('.*');
      queryObj.$or = [
        { title: { $regex: raw, $options: 'i' } },
        { title: { $regex: fuzzy, $options: 'i' } },
        { organizerName: { $regex: raw, $options: 'i' } },
        { organizerName: { $regex: fuzzy, $options: 'i' } },
        { description: { $regex: raw, $options: 'i' } },
        { venue: { $regex: raw, $options: 'i' } }
      ];
    }

    // Filter by category
    if (reqQuery.category) {
      queryObj.category = reqQuery.category;
    }

    // Filter by status
    if (reqQuery.status) {
      queryObj.status = reqQuery.status;
    } else {
      // Default: only show approved events for non-admin users
      if (!req.user || req.user.role !== 'Admin') {
        queryObj.status = 'approved';
      }
    }

    // Filter by eligibility
    if (reqQuery.eligibility) {
      queryObj.eligibility = { $in: getEligibilityAliases(reqQuery.eligibility) };
    } else if (req.user && req.user.role === 'Participant') {
      const participantEligibility = req.user.participantType === 'IIIT' ? 'IIIT' : 'Non-IIIT';
      queryObj.eligibility = {
        $in: [
          ...getEligibilityAliases('All'),
          ...getEligibilityAliases(participantEligibility)
        ]
      };
    }

    // Filter by organizer
    if (reqQuery.organizer) {
      queryObj.organizer = reqQuery.organizer;
    }

    // Filter by club(s)
    if (reqQuery.clubIds) {
      const clubIds = reqQuery.clubIds.split(',').map(id => id.trim()).filter(Boolean);
      queryObj.clubId = { $in: clubIds };
    }

    // Filter by date range
    if (reqQuery.dateFrom || reqQuery.dateTo) {
      queryObj.date = {};
      if (reqQuery.dateFrom) {
        queryObj.date.$gte = new Date(reqQuery.dateFrom);
      }
      if (reqQuery.dateTo) {
        queryObj.date.$lte = new Date(reqQuery.dateTo);
      }
    }

    // Filter by team requirement (support both allowTeams and legacy requiresTeam param)
    if (reqQuery.allowTeams !== undefined) {
      queryObj.allowTeams = reqQuery.allowTeams === 'true';
    } else if (reqQuery.requiresTeam !== undefined) {
      queryObj.allowTeams = reqQuery.requiresTeam === 'true';
    }

    // Create query
    let query = Event.find(queryObj).populate('organizer', 'firstName lastName email');

    // Select fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      // Default sort by date (upcoming first)
      query = query.sort('date');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    // Frontend currently does not handle pagination; return a larger default page size
    const limit = parseInt(req.query.limit, 10) || 1000;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Event.countDocuments(queryObj);

    query = query.skip(startIndex).limit(limit);

    // Execute query
    let events = await query;

    // Apply preference-based ordering if user is authenticated and has preferences
    if (req.user && req.user.preferences && !reqQuery.trending && !req.query.sort) {
      const userInterests = (req.user.preferences.interests || []).map(i => (i || '').toLowerCase());
      const userFollowedClubs = (req.user.preferences.followedClubs || []).map(club =>
        typeof club === 'object' ? club._id.toString() : club.toString()
      );

      const interestMatches = (value) => {
        if (!value) return false;
        const v = String(value).toLowerCase();
        return userInterests.some(interest =>
          interest === v || v.includes(interest) || interest.includes(v)
        );
      };

      // Score each event based on user preferences (ordering + recommendations)
      events = events.map(event => {
        let score = 0;

        // +2 points if event is from a followed club
        if (event.clubId && userFollowedClubs.includes(event.clubId.toString())) {
          score += 2;
        }

        // +1 point if event category matches a user interest (e.g. Sports, Music, Technical)
        if (event.category && interestMatches(event.category)) {
          score += 1;
        }

        // +1 point for each matching interest tag
        if (event.tags && Array.isArray(event.tags)) {
          const matchingTags = event.tags.filter(tag =>
            tag && interestMatches(tag)
          );
          score += matchingTags.length;
        }

        return { event, score };
      })
        .sort((a, b) => {
          // Sort by score (descending), then by date (ascending)
          if (b.score !== a.score) return b.score - a.score;
          return new Date(a.event.date) - new Date(b.event.date);
        })
        .map(item => item.event);
    }

    // Trending (top 5 in last 24h)
    if (reqQuery.trending === 'true') {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const counts = await Registration.aggregate([
        { $match: { registrationDate: { $gte: since } } },
        { $group: { _id: '$event', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
      const ranked = new Map(counts.map(c => [c._id.toString(), c.count]));
      events = events
        .filter(e => ranked.has(e._id.toString()))
        .sort((a, b) => (ranked.get(b._id.toString()) || 0) - (ranked.get(a._id.toString()) || 0));
    }

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      pagination,
      data: events.map(event => ({
        ...applyLifecycleStatus(event).toObject(),
        lifecycleStatus: computeLifecycleStatus(event)
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'firstName lastName email contactNumber')
      .populate('clubId', 'name contact');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...applyLifecycleStatus(event).toObject(),
        lifecycleStatus: computeLifecycleStatus(event)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Organizer - own events or Admin)
exports.updateEvent = async (req, res, next) => {
  try {
    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is event organizer or admin
    if (event.organizer.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this event'
      });
    }

    // Don't allow changing organizer
    delete req.body.organizer;

    const effectiveLifecycleStatus = computeLifecycleStatus(event);

    // Prevent custom field edits after first registration
    if (req.body.customFields) {
      const registrationCount = await Registration.countDocuments({ event: event._id });
      if (registrationCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Registration form is locked after first registration'
        });
      }
    }

    // Enforce editing rules based on lifecycle status
    if (req.user.role !== 'Admin') {
      if (effectiveLifecycleStatus === 'published') {
        const allowed = ['description', 'registrationDeadline', 'capacity', 'maxParticipants', 'isClosed'];
        const invalid = Object.keys(req.body).filter(key => !allowed.includes(key));
        if (invalid.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Only description, deadline, capacity, or closing is allowed after publish'
          });
        }

        if (req.body.capacity !== undefined || req.body.maxParticipants !== undefined) {
          const currentCap = Math.max(event.capacity || 0, event.maxParticipants || 0);
          const nextCap = Number(
            req.body.capacity !== undefined
              ? req.body.capacity
              : req.body.maxParticipants !== undefined
                ? req.body.maxParticipants
                : currentCap
          );
          if (!Number.isNaN(nextCap) && nextCap < currentCap) {
            return res.status(400).json({
              success: false,
              message: 'Capacity can only be increased after publish'
            });
          }
        }

        if (req.body.registrationDeadline && event.registrationDeadline) {
          const currentDeadline = new Date(event.registrationDeadline);
          const nextDeadline = new Date(req.body.registrationDeadline);
          if (nextDeadline < currentDeadline) {
            return res.status(400).json({
              success: false,
              message: 'Registration deadline can only be extended after publish'
            });
          }
        }
      }

      if (effectiveLifecycleStatus === 'ongoing' || effectiveLifecycleStatus === 'completed' || effectiveLifecycleStatus === 'closed') {
        const allowed = ['lifecycleStatus', 'isClosed'];
        const invalid = Object.keys(req.body).filter(key => !allowed.includes(key));
        if (invalid.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Event cannot be edited after it has started or closed'
          });
        }
      }
    }

    if (req.body.date || req.body.endDate) {
      const start = new Date(req.body.date || event.date);
      const end = new Date(req.body.endDate || event.endDate);
      if (end < start) {
        return res.status(400).json({
          success: false,
          message: 'Event end date must be on or after the start date'
        });
      }
    }

    if (req.body.registrationDeadline) {
      const deadline = new Date(req.body.registrationDeadline);
      const start = new Date(req.body.date || event.date);
      if (deadline > start) {
        return res.status(400).json({
          success: false,
          message: 'Registration deadline must be before the event start date'
        });
      }
    }

    event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: {
        ...applyLifecycleStatus(event).toObject(),
        lifecycleStatus: computeLifecycleStatus(event)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Organizer - own events or Admin)
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is event organizer or admin
    if (event.organizer.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }

    await event.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve/Reject event
// @route   PUT /api/events/:id/approve
// @access  Private (Admin only)
exports.approveEvent = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either approved or rejected'
      });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    event.status = status;
    if (status === 'rejected') {
      event.rejectionReason = rejectionReason;
    }

    if (status === 'approved' && event.lifecycleStatus === 'draft') {
      event.lifecycleStatus = 'published';
    }

    await event.save();

    if (status === 'approved') {
      let webhookUrl;
      if (event.organizer) {
        const organizer = await User.findById(event.organizer).select('organizerProfile');
        webhookUrl = organizer?.organizerProfile?.discordWebhook;
      }
      postEventToDiscord(event, webhookUrl);
    }

    res.status(200).json({
      success: true,
      data: {
        ...applyLifecycleStatus(event).toObject(),
        lifecycleStatus: computeLifecycleStatus(event)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Publish event (move draft to approved/published)
// @route   PUT /api/events/:id/publish
// @access  Private (Organizer/Admin)
exports.publishEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.organizer.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to publish this event'
      });
    }

    event.status = 'approved';
    event.lifecycleStatus = 'published';
    await event.save();

    // Auto-post new event to organizer's Discord webhook
    let webhookUrl;
    if (event.organizer) {
      const organizer = await User.findById(event.organizer).select('organizerProfile');
      webhookUrl = organizer?.organizerProfile?.discordWebhook;
    }
    postEventToDiscord(event, webhookUrl);

    res.status(200).json({
      success: true,
      data: {
        ...applyLifecycleStatus(event).toObject(),
        lifecycleStatus: computeLifecycleStatus(event)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get organizer's events
// @route   GET /api/events/organizer/my-events
// @access  Private (Organizer only)
exports.getMyEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ organizer: req.user.id })
      .sort('-createdAt')
      .populate('clubId', 'name');

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get event statistics
// @route   GET /api/events/:id/stats
// @access  Private (Organizer - own events or Admin)
exports.getEventStats = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

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
        message: 'Not authorized to view event statistics'
      });
    }

    const capacity = event.capacity || event.maxParticipants || 0;
    const registered = event.registered || 0;

    // Basic event stats; registration aggregation can extend this later
    const stats = {
      eventId: event._id,
      eventTitle: event.title,
      totalCapacity: capacity,
      registeredParticipants: registered,
      availableSpots: Math.max(capacity - registered, 0),
      status: event.status,
      requiresTeam: event.allowTeams,
      requiresPayment: (event.registrationFee || 0) > 0
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};
