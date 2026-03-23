const mongoose = require('mongoose');

const resetStatusHistorySchema = new mongoose.Schema({
  fromStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  toStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    required: true
  },
  comment: {
    type: String,
    trim: true,
    default: ''
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  changedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const passwordResetRequestSchema = new mongoose.Schema({
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  adminComment: {
    type: String,
    trim: true,
    default: ''
  },
  generatedPassword: {
    type: String,
    trim: true,
    default: ''
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  history: {
    type: [resetStatusHistorySchema],
    default: []
  }
}, {
  timestamps: true
});

passwordResetRequestSchema.index({ organizer: 1, requestedAt: -1 });
passwordResetRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
