const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['Participant', 'Organizer', 'Admin'],
    default: 'Participant'
  },
  participantType: {
    type: String,
    enum: ['IIIT', 'Non-IIIT'],
    required: function() {
      return this.role === 'Participant';
    }
  },
  college: {
    type: String,
    trim: true
  },
  contactNumber: {
    type: String,
    trim: true
  },
  clubId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Club'
  },
  organizerProfile: {
    name: String,
    category: String,
    description: String,
    contactEmail: String,
    contactNumber: String,
    discordWebhook: String
  },
  preferences: {
    interests: [{ type: String }],
    followedClubs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Club' }]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('User', userSchema);
