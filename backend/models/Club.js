const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Club name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Club description is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Technical', 'Cultural', 'Sports', 'Academic', 'Social', 'Arts']
  },
  president: {
    type: String,
    required: true
  },
  headCoordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  contact: {
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone: String
  },
  logo: {
    type: String
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  organizers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Club', clubSchema);
