const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
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
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  categories: {
    organization: {
      type: Number,
      min: 1,
      max: 5
    },
    content: {
      type: Number,
      min: 1,
      max: 5
    },
    venue: {
      type: Number,
      min: 1,
      max: 5
    },
    value: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  comment: {
    type: String,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  helpful: {
    type: Number,
    default: 0
  },
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Indexes
feedbackSchema.index({ event: 1, user: 1 }, { unique: true });
feedbackSchema.index({ event: 1, rating: -1 });
feedbackSchema.index({ createdAt: -1 });

// Calculate average rating after save
feedbackSchema.post('save', async function () {
  const Event = mongoose.model('Event');
  const feedbacks = await this.constructor.find({ event: this.event });

  if (feedbacks.length > 0) {
    const avgRating = feedbacks.reduce((sum, fb) => sum + fb.rating, 0) / feedbacks.length;
    await Event.findByIdAndUpdate(this.event, {
      averageRating: avgRating.toFixed(1),
      totalFeedbacks: feedbacks.length
    });
  } else {
    await Event.findByIdAndUpdate(this.event, {
      averageRating: 0,
      totalFeedbacks: 0
    });
  }
});

// Recalculate average rating after deletion
const recalcRatingAfterDelete = async function (doc) {
  if (!doc) return;
  const Event = mongoose.model('Event');
  const Feedback = mongoose.model('Feedback');
  const feedbacks = await Feedback.find({ event: doc.event });

  if (feedbacks.length > 0) {
    const avgRating = feedbacks.reduce((sum, fb) => sum + fb.rating, 0) / feedbacks.length;
    await Event.findByIdAndUpdate(doc.event, {
      averageRating: avgRating.toFixed(1),
      totalFeedbacks: feedbacks.length
    });
  } else {
    await Event.findByIdAndUpdate(doc.event, {
      averageRating: 0,
      totalFeedbacks: 0
    });
  }
};

feedbackSchema.post('findOneAndDelete', recalcRatingAfterDelete);
feedbackSchema.post('deleteOne', { document: true, query: false }, recalcRatingAfterDelete);

module.exports = mongoose.model('Feedback', feedbackSchema);
