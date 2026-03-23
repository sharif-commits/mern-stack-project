const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    minlength: [20, 'Description must be at least 20 characters']
  },
  date: {
    type: Date,
    required: [true, 'Event date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'Event end date is required']
  },
  time: {
    type: String,
    required: [true, 'Event time is required']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  venue: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Event', 'Workshop', 'Competition', 'Seminar', 'Merchandise']
  },
  category: {
    type: String,
    required: true,
    enum: ['Technical', 'Cultural', 'Sports', 'Academic', 'Workshop', 'Competition', 'Seminar', 'Other']
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizerName: {
    type: String,
    required: true
  },
  clubId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Club'
  },
  capacity: {
    type: Number,
    required: [true, 'Maximum participants is required'],
    min: [1, 'Capacity must be at least 1']
  },
  maxParticipants: {
    type: Number,
    required: true
  },
  registered: {
    type: Number,
    default: 0
  },
  registrationDeadline: {
    type: Date,
    required: [true, 'Registration deadline is required']
  },
  eligibility: {
    type: String,
    enum: ['All', 'IIIT', 'Non-IIIT'],
    default: 'All'
  },
  participantType: {
    type: String,
    enum: ['Individual', 'Team', 'Both'],
    default: 'Individual'
  },
  allowTeams: {
    type: Boolean,
    default: false
  },
  minTeamSize: {
    type: Number,
    default: 2
  },
  maxTeamSize: {
    type: Number,
    default: 5
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  requiresPayment: {
    type: Boolean,
    default: false
  },
  registrationFee: {
    type: Number,
    default: 0,
    min: 0
  },
  merchandise: {
    itemName: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    sizes: [{ type: String, trim: true }],
    colors: [{ type: String, trim: true }],
    variants: [
      {
        sku: { type: String, trim: true },
        size: { type: String, trim: true },
        color: { type: String, trim: true },
        price: { type: Number, min: 0, default: 0 },
        stock: { type: Number, min: 0, default: 0 }
      }
    ],
    stock: { type: Number, min: 0, default: 0 },
    purchaseLimit: { type: Number, min: 1, default: 1 }
  },
  paymentAmount: {
    type: Number,
    default: 0
  },
  imageUrl: {
    type: String
  },
  tags: [{
    type: String
  }],
  customFields: [{
    label: String,
    type: {
      type: String,
      enum: ['text', 'email', 'number', 'textarea', 'select', 'checkbox', 'radio', 'file', 'date']
    },
    required: Boolean,
    options: [String]
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'draft'],
    default: 'draft'
  },
  lifecycleStatus: {
    type: String,
    enum: ['draft', 'published', 'ongoing', 'closed', 'completed'],
    default: 'draft'
  },
  isClosed: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  averageRating: {
    type: Number,
    default: 0
  },
  totalFeedbacks: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
eventSchema.index({ date: 1, status: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });

module.exports = mongoose.model('Event', eventSchema);
