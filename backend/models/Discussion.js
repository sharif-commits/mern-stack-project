const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  emoji: {
    type: String,
    required: true,
    trim: true,
    maxlength: 8
  }
}, { _id: false, timestamps: true });

const replySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  parentReplyId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  reactions: {
    type: [reactionSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const discussionSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['General', 'Questions', 'Technical', 'Suggestions', 'Issues', 'Announcements'],
    default: 'General'
  },
  title: {
    type: String,
    required: [true, 'Discussion title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Discussion content is required']
  },
  isAnnouncement: {
    type: Boolean,
    default: false
  },
  replies: {
    type: [replySchema],
    default: []
  },
  reactions: {
    type: [reactionSchema],
    default: []
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
discussionSchema.index({ event: 1, createdAt: -1 });
discussionSchema.index({ event: 1, isPinned: -1, isAnnouncement: -1, updatedAt: -1 });
discussionSchema.index({ author: 1 });
discussionSchema.index({ category: 1 });

module.exports = mongoose.model('Discussion', discussionSchema);
