const mongoose = require('mongoose');

const teamInviteSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  respondedAt: {
    type: Date
  }
}, { _id: true });

const teamSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  teamName: {
    type: String,
    required: true,
    trim: true
  },
  desiredTeamSize: {
    type: Number,
    required: true,
    min: 2
  },
  inviteCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  invites: [teamInviteSchema],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['forming', 'completed', 'cancelled'],
    default: 'forming',
    index: true
  },
  registrationIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration'
  }],
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

teamSchema.index({ event: 1, teamName: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
