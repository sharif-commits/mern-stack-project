const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participantName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String
  },
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'confirmed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'free', 'refunded'],
    default: 'pending'
  },
  paymentApprovalStatus: {
    type: String,
    enum: ['awaiting-proof', 'pending', 'approved', 'rejected', 'not-required'],
    default: 'not-required'
  },
  paymentAmount: {
    type: Number,
    default: 0
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    trim: true
  },
  paymentScreenshot: {
    type: String
  },
  merchandise: {
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    variantSku: { type: String, trim: true },
    quantity: { type: Number, min: 1, default: 1 },
    unitPrice: { type: Number, min: 0, default: 0 },
    totalPrice: { type: Number, min: 0, default: 0 }
  },
  transactionId: {
    type: String
  },
  isTeam: {
    type: Boolean,
    default: false
  },
  teamName: {
    type: String
  },
  teamLeader: {
    name: String,
    email: String,
    phone: String
  },
  teamMembers: [{
    name: String,
    email: String,
    phone: String
  }],
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  customFieldResponses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkInTime: {
    type: Date
  },
  ticketQr: {
    type: String
  },
  ticketIssuedAt: {
    type: Date
  },
  registrationDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
registrationSchema.index({ event: 1, user: 1 });
registrationSchema.index({ status: 1 });

// Generate unique ticket ID before validation
registrationSchema.pre('validate', function() {
  if (this.isNew && !this.ticketId) {
    this.ticketId = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
});

module.exports = mongoose.model('Registration', registrationSchema);
