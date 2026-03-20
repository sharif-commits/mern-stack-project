const Discussion = require('../models/Discussion');
const Event = require('../models/Event');
const Registration = require('../models/Registration');

const DISCUSSION_ALLOWED_REACTIONS = ['👍', '❤️', '🔥', '👏', '❓'];

const ensureDiscussionAccess = async ({ eventId, user }) => {
  const event = await Event.findById(eventId);
  if (!event) {
    return { allowed: false, reason: 'Event not found', code: 404, event: null };
  }

  const isOrganizer = event.organizer.toString() === user.id;
  const isAdmin = user.role === 'Admin';

  if (isOrganizer || isAdmin) {
    return { allowed: true, event, isOrganizer, isAdmin, isRegistered: true };
  }

  const isRegistered = await Registration.findOne({
    event: eventId,
    user: user.id,
    status: { $in: ['confirmed', 'approved'] }
  });

  if (!isRegistered) {
    return {
      allowed: false,
      reason: 'Only registered participants can post in this forum',
      code: 403,
      event,
      isOrganizer,
      isAdmin,
      isRegistered: false
    };
  }

  return { allowed: true, event, isOrganizer, isAdmin, isRegistered: true };
};

const normalizeDiscussionOutput = (discussion) => {
  const data = discussion.toObject ? discussion.toObject() : discussion;
  const topLevel = (data.replies || []).filter(reply => !reply.parentReplyId);
  const replyCount = (data.replies || []).length;
  return {
    ...data,
    topLevelReplyCount: topLevel.length,
    replyCount
  };
};

const toggleReaction = (collection, userId, emoji) => {
  const index = collection.findIndex(
    reaction => reaction.user.toString() === userId && reaction.emoji === emoji
  );

  if (index >= 0) {
    collection.splice(index, 1);
    return 'removed';
  }

  collection.push({ user: userId, emoji });
  return 'added';
};

// @desc    Create a discussion
// @route   POST /api/discussions
// @access  Private (Registered participants for the event)
exports.createDiscussion = async (req, res, next) => {
  try {
    const { eventId, title, content, category, isAnnouncement = false } = req.body;

    const access = await ensureDiscussionAccess({ eventId, user: req.user });
    if (!access.allowed) {
      return res.status(access.code).json({
        success: false,
        message: access.reason
      });
    }

    if (isAnnouncement && !access.isOrganizer && !access.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only organizers/admin can post announcements'
      });
    }

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    const discussion = await Discussion.create({
      event: eventId,
      author: req.user.id,
      title,
      content,
      category: isAnnouncement ? 'Announcements' : category,
      isAnnouncement: Boolean(isAnnouncement)
    });

    await discussion.populate('author', 'firstName lastName role');

    res.status(201).json({
      success: true,
      data: normalizeDiscussionOutput(discussion)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get discussions for an event
// @route   GET /api/discussions/event/:eventId
// @access  Public
exports.getEventDiscussions = async (req, res, next) => {
  try {
    const { category, sort = '-updatedAt', since } = req.query;

    const query = { event: req.params.eventId };
    if (category) {
      query.category = category;
    }
    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        query.updatedAt = { $gt: sinceDate };
      }
    }

    const discussions = await Discussion.find(query)
      .populate('author', 'firstName lastName role')
      .populate('replies.author', 'firstName lastName role')
      .populate('reactions.user', 'firstName lastName')
      .populate('replies.reactions.user', 'firstName lastName')
      .sort(sort === '-updatedAt' ? { isPinned: -1, isAnnouncement: -1, updatedAt: -1 } : sort);

    const data = discussions.map(normalizeDiscussionOutput);

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single discussion
// @route   GET /api/discussions/:id
// @access  Public
exports.getDiscussion = async (req, res, next) => {
  try {
    const discussion = await Discussion.findById(req.params.id)
      .populate('author', 'firstName lastName role')
      .populate('replies.author', 'firstName lastName role')
      .populate('reactions.user', 'firstName lastName')
      .populate('replies.reactions.user', 'firstName lastName')
      .populate('event', 'title');

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Increment view count
    discussion.viewCount += 1;
    await discussion.save();

    res.status(200).json({
      success: true,
      data: normalizeDiscussionOutput(discussion)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to a discussion
// @route   POST /api/discussions/:id/reply
// @access  Private (Registered participants)
exports.replyToDiscussion = async (req, res, next) => {
  try {
    const { content, parentReplyId } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply content is required'
      });
    }

    const discussion = await Discussion.findById(req.params.id).populate('event');

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    const access = await ensureDiscussionAccess({ eventId: discussion.event._id, user: req.user });
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: access.reason
      });
    }

    if (parentReplyId) {
      const parent = discussion.replies.id(parentReplyId);
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Parent message not found'
        });
      }
    }

    discussion.replies.push({
      author: req.user.id,
      content: String(content).trim(),
      parentReplyId: parentReplyId || null
    });
    discussion.updatedAt = new Date();

    await discussion.save();
    await discussion.populate('replies.author', 'firstName lastName role');

    res.status(200).json({
      success: true,
      data: normalizeDiscussionOutput(discussion)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update discussion
// @route   PUT /api/discussions/:id
// @access  Private (Author or Admin)
exports.updateDiscussion = async (req, res, next) => {
  try {
    let discussion = await Discussion.findById(req.params.id);

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check authorization
    if (discussion.author.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this discussion'
      });
    }

    const { title, content, category, isResolved } = req.body;

    if (title) discussion.title = title;
    if (content) discussion.content = content;
    if (category) discussion.category = category;
    if (isResolved !== undefined) discussion.isResolved = isResolved;

    discussion.updatedAt = new Date();
    await discussion.save();

    res.status(200).json({
      success: true,
      data: normalizeDiscussionOutput(discussion)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete discussion
// @route   DELETE /api/discussions/:id
// @access  Private (Author or Organizer or Admin)
exports.deleteDiscussion = async (req, res, next) => {
  try {
    const discussion = await Discussion.findById(req.params.id).populate('event');

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check authorization
    const isAuthor = discussion.author.toString() === req.user.id;
    const isOrganizer = discussion.event.organizer.toString() === req.user.id;
    const isAdmin = req.user.role === 'Admin';

    if (!isAuthor && !isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this discussion'
      });
    }

    await discussion.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Pin/Unpin discussion
// @route   PUT /api/discussions/:id/pin
// @access  Private (Organizer or Admin)
exports.togglePin = async (req, res, next) => {
  try {
    const discussion = await Discussion.findById(req.params.id).populate('event');

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check authorization
    const isOrganizer = discussion.event.organizer.toString() === req.user.id;
    const isAdmin = req.user.role === 'Admin';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to pin discussions'
      });
    }

    discussion.isPinned = !discussion.isPinned;
    discussion.updatedAt = new Date();
    await discussion.save();

    res.status(200).json({
      success: true,
      data: normalizeDiscussionOutput(discussion)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a reply in discussion
// @route   DELETE /api/discussions/:id/replies/:replyId
// @access  Private (Reply author, Organizer/Admin)
exports.deleteReply = async (req, res, next) => {
  try {
    const discussion = await Discussion.findById(req.params.id).populate('event');

    if (!discussion) {
      return res.status(404).json({ success: false, message: 'Discussion not found' });
    }

    const reply = discussion.replies.id(req.params.replyId);
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }

    const isReplyAuthor = reply.author.toString() === req.user.id;
    const isOrganizer = discussion.event.organizer.toString() === req.user.id;
    const isAdmin = req.user.role === 'Admin';

    if (!isReplyAuthor && !isOrganizer && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this reply' });
    }

    const childReplyIds = discussion.replies
      .filter(item => item.parentReplyId && item.parentReplyId.toString() === reply._id.toString())
      .map(item => item._id.toString());

    discussion.replies = discussion.replies.filter(item =>
      item._id.toString() !== reply._id.toString() && !childReplyIds.includes(item._id.toString())
    );
    discussion.updatedAt = new Date();
    await discussion.save();
    await discussion.populate('replies.author', 'firstName lastName role');

    res.status(200).json({
      success: true,
      data: normalizeDiscussionOutput(discussion)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle reaction on discussion
// @route   PUT /api/discussions/:id/react
// @access  Private (Registered participants, organizer/admin)
exports.reactToDiscussion = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!DISCUSSION_ALLOWED_REACTIONS.includes(emoji)) {
      return res.status(400).json({ success: false, message: 'Unsupported reaction' });
    }

    const discussion = await Discussion.findById(req.params.id).populate('event');
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'Discussion not found' });
    }

    const access = await ensureDiscussionAccess({ eventId: discussion.event._id, user: req.user });
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: access.reason });
    }

    const action = toggleReaction(discussion.reactions, req.user.id, emoji);
    discussion.updatedAt = new Date();
    await discussion.save();
    await discussion.populate('reactions.user', 'firstName lastName');

    res.status(200).json({
      success: true,
      action,
      data: normalizeDiscussionOutput(discussion)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle reaction on reply
// @route   PUT /api/discussions/:id/replies/:replyId/react
// @access  Private (Registered participants, organizer/admin)
exports.reactToReply = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!DISCUSSION_ALLOWED_REACTIONS.includes(emoji)) {
      return res.status(400).json({ success: false, message: 'Unsupported reaction' });
    }

    const discussion = await Discussion.findById(req.params.id).populate('event');
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'Discussion not found' });
    }

    const access = await ensureDiscussionAccess({ eventId: discussion.event._id, user: req.user });
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: access.reason });
    }

    const reply = discussion.replies.id(req.params.replyId);
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }

    const action = toggleReaction(reply.reactions, req.user.id, emoji);
    reply.updatedAt = new Date();
    discussion.updatedAt = new Date();
    await discussion.save();
    await discussion.populate('replies.reactions.user', 'firstName lastName');

    res.status(200).json({
      success: true,
      action,
      data: normalizeDiscussionOutput(discussion)
    });
  } catch (error) {
    next(error);
  }
};
