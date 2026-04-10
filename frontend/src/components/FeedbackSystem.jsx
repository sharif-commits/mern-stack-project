import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { useToast } from './Toast.jsx';
import { feedbackAPI, registrationsAPI } from '../utils/api';
import { formatDate } from '../utils/helpers.js';
import './FeedbackSystem.css';

function FeedbackSystem() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { events } = useData();
  const { showSuccess, showError } = useToast();

  const [feedbacks, setFeedbacks] = useState([]);
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [stats, setStats] = useState({
    totalFeedbacks: 0,
    averageRating: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    categoryAverages: { organization: 0, content: 0, venue: 0, value: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [ratingFilter, setRatingFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    rating: 5,
    comment: '',
    anonymous: false
  });

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setLoading(true);
        const params = {};
        if (ratingFilter !== 'all') {
          params.rating = ratingFilter;
        }

        const response = await feedbackAPI.getEventFeedback(eventId, params);
        if (response.success) {
          setFeedbacks(response.data || []);
          setStats(response.stats || {
            totalFeedbacks: 0,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            categoryAverages: { organization: 0, content: 0, venue: 0, value: 0 }
          });
        }
      } catch (err) {
        console.error('Error fetching feedback:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [eventId, ratingFilter]);

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        const response = await registrationsAPI.getUserRegistrations();
        if (response.success) {
          setRegistrations(response.data || []);
        }
      } catch (err) {
        console.error('Error fetching registrations:', err);
      }
    };

    if (user) {
      fetchRegistrations();
    }
  }, [user]);

  useEffect(() => {
    const fetchMyFeedback = async () => {
      if (!user) return;
      try {
        const response = await feedbackAPI.getMyFeedback();
        if (response.success) {
          setMyFeedbacks(response.data || []);
        }
      } catch (err) {
        console.error('Error fetching my feedback:', err);
      }
    };

    fetchMyFeedback();
  }, [user]);

  const event = events.find(e => (e._id || e.id) === eventId);
  const organizerId = event?.organizer?._id || event?.organizer || event?.organizerId;
  const isOrganizerView = user?.role === 'Admin' || (organizerId && organizerId.toString() === user?.id?.toString());
  const userRegistration = registrations.find(
    r => (r.event?._id || r.eventId || r.event)?.toString() === eventId?.toString()
  );

  const eventHasEnded = useMemo(() => {
    if (!event) return false;
    const end = new Date(event.endDate || event.date);
    return end <= new Date();
  }, [event]);

  const eventFeedbacks = useMemo(() => feedbacks, [feedbacks]);

  const getAuthorName = (feedback) => {
    if (!feedback.user) return 'Anonymous';
    const name = `${feedback.user.firstName || ''} ${feedback.user.lastName || ''}`.trim();
    return name || feedback.user.email || 'Anonymous';
  };

  const categories = [
    'Overall Experience',
    'Content Quality',
    'Organization',
    'Venue & Facilities',
    'Speaker/Instructor',
    'Value for Money'
  ];

  const averageRating = useMemo(() => {
    return Number(stats.averageRating || 0).toFixed(1);
  }, [stats]);

  const ratingDistribution = useMemo(() => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    Object.entries(stats.ratingDistribution || {}).forEach(([key, value]) => {
      distribution[key] = value;
    });
    return distribution;
  }, [stats]);

  const totalFeedbacks = useMemo(() => {
    return Number(stats.totalFeedbacks || 0);
  }, [stats]);

  const recommendationRate = useMemo(() => {
    if (!totalFeedbacks) return 0;
    const recommended = Number(ratingDistribution[5] || 0) + Number(ratingDistribution[4] || 0);
    return ((recommended / totalFeedbacks) * 100).toFixed(0);
  }, [ratingDistribution, totalFeedbacks]);

  if (!event) {
    return (
      <div className="feedback-container">
        <div className="not-found">
          <h2>Event Not Found</h2>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const hasUserSubmittedFeedback = feedbacks.some(
    f => (f.user?._id || f.user)?.toString() === user?.id?.toString()
  ) || myFeedbacks.some(
    f => (f.event?._id || f.eventId || f.event)?.toString() === eventId?.toString()
  );

  const canSubmitFeedback =
    eventHasEnded &&
    userRegistration &&
    userRegistration.status === 'confirmed';

  const handleSubmitFeedback = async () => {
    if (!newFeedback.comment.trim()) {
      showError('Please fill in all required fields');
      return;
    }

    if (hasUserSubmittedFeedback) {
      showError('You have already submitted feedback for this event');
      return;
    }

    if (!eventHasEnded) {
      showError('Feedback can be submitted only after the event ends');
      return;
    }

    try {
      const response = await feedbackAPI.submit({
        eventId,
        rating: newFeedback.rating,
        comment: newFeedback.comment,
        isAnonymous: newFeedback.anonymous
      });

      if (response.success) {
        setFeedbacks(prev => [response.data, ...prev]);
        setNewFeedback({
          rating: 5,
          comment: '',
          anonymous: false
        });
        setShowFeedbackForm(false);
        showSuccess('Thank you for your feedback!');
      } else {
        showError(response.message || 'Failed to submit feedback');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      showError('Failed to submit feedback');
    }
  };

  const handleMarkHelpful = async (feedbackId) => {
    try {
      const response = await feedbackAPI.markHelpful(feedbackId);
      if (response.success) {
        setFeedbacks(prev => prev.map(f => (f._id === feedbackId ? response.data : f)));
        showSuccess('Marked as helpful');
      } else {
        showError(response.message || 'Failed to mark helpful');
      }
    } catch (err) {
      showError('Failed to mark helpful');
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = {};
      if (ratingFilter !== 'all') {
        params.rating = ratingFilter;
      }
      const { blob, fileName } = await feedbackAPI.exportEventFeedback(eventId, params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccess('Feedback exported successfully');
    } catch (error) {
      showError(error.message || 'Failed to export feedback');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="feedback-container">
      <div className="feedback-header">
        <div className="header-content">
          <Link to={`/event/${eventId}`} className="btn-back">
            Back to Event
          </Link>
          <div className="header-info">
            <h1>Event Feedback</h1>
            <p className="event-title">{event.title}</p>
          </div>
        </div>
        {canSubmitFeedback && !hasUserSubmittedFeedback && (
          <button
            className="btn btn-primary"
            onClick={() => setShowFeedbackForm(true)}
          >
            + Submit Feedback
          </button>
        )}
      </div>

      {/* Overall Stats */}
      <div className="feedback-stats-grid">
        <div className="stat-card-large">
          <div className="rating-display">
            <div className="rating-number">{averageRating}</div>
            <div className="rating-stars">
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} className={star <= Math.round(averageRating) ? 'star filled' : 'star'}>
                  *
                </span>
              ))}
            </div>
            <div className="rating-count">{totalFeedbacks} reviews</div>
          </div>
        </div>

        <div className="stat-card-large">
          <h3>Rating Distribution</h3>
          <div className="rating-bars">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = ratingDistribution[rating];
              const percentage = totalFeedbacks > 0 ? (count / totalFeedbacks) * 100 : 0;
              return (
                <div key={rating} className="rating-bar-row">
                  <span className="rating-label">{rating} *</span>
                  <div className="rating-bar">
                    <div
                      className="rating-bar-fill"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="rating-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">%</div>
          <div className="stat-content">
            <div className="stat-value">{recommendationRate}%</div>
            <div className="stat-label">Would Recommend</div>
          </div>
        </div>
      </div>

      {/* Feedback List */}
      <div className="feedbacks-section">
        <div className="feedback-list-header">
          <h2>Participant Reviews</h2>
          {isOrganizerView && (
            <div className="feedback-actions-row">
              <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
              <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exporting...' : 'Export Feedback CSV'}
              </button>
            </div>
          )}
        </div>

        {eventFeedbacks.length === 0 ? (
          <div className="empty-state">
            <p>No feedback yet. Be the first to share your experience!</p>
          </div>
        ) : (
          <div className="feedbacks-list">
            {eventFeedbacks.map(feedback => (
              <div key={feedback._id || feedback.id} className="feedback-card">
                <div className="feedback-header-row">
                  <div className="feedback-author">
                    <div className="author-avatar">
                      {getAuthorName(feedback).charAt(0)}
                    </div>
                    <div className="author-info">
                      <div className="author-name">{getAuthorName(feedback)}</div>
                      <div className="feedback-date">{formatDate(feedback.createdAt)}</div>
                    </div>
                  </div>
                <div className="feedback-rating">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={star <= feedback.rating ? 'star filled' : 'star'}>
                      *
                    </span>
                  ))}
                </div>
                </div>

                <div className="feedback-category">
                  <span className="category-tag">Overall Experience</span>
                  {feedback.isAnonymous && <span className="category-tag">Anonymous</span>}
                </div>

                <p className="feedback-comment">{feedback.comment}</p>

                <div className="feedback-footer">
                  <button
                    className="btn-helpful"
                    onClick={() => handleMarkHelpful(feedback._id || feedback.id)}
                  >
                    Mark as helpful ({feedback.helpful || 0})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Form Modal */}
      {showFeedbackForm && (
        <div className="modal-overlay" onClick={() => setShowFeedbackForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit Your Feedback</h2>
              <button className="close-btn" onClick={() => setShowFeedbackForm(false)}>X</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Overall Rating</label>
                <div className="rating-selector">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      className={`star-btn ${rating <= newFeedback.rating ? 'selected' : ''}`}
                      onClick={() => setNewFeedback({ ...newFeedback, rating })}
                    >
                      *
                    </button>
                  ))}
                  <span className="rating-text">{newFeedback.rating} out of 5</span>
                </div>
              </div>

              <div className="form-group">
                <label>Feedback Type</label>
                <input type="text" value={categories[0]} disabled />
              </div>

              <div className="form-group">
                <label>Your Review</label>
                <textarea
                  placeholder="Share your detailed feedback..."
                  rows="6"
                  value={newFeedback.comment}
                  onChange={(e) => setNewFeedback({ ...newFeedback, comment: e.target.value })}
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newFeedback.anonymous}
                    onChange={(e) => setNewFeedback({ ...newFeedback, anonymous: e.target.checked })}
                  />
                  Submit anonymously
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowFeedbackForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmitFeedback}>
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User's Feedback Notice */}
      {hasUserSubmittedFeedback && (
        <div className="user-feedback-notice">
          <span className="notice-icon">!</span>
          <span>You have already submitted feedback for this event. Thank you!</span>
        </div>
      )}

      {!canSubmitFeedback && user && (
        <div className="user-feedback-notice warning">
          <span className="notice-icon">i</span>
          <span>
            {!eventHasEnded
              ? `Feedback will open after the event ends (${formatDate(event.endDate || event.date)}).`
              : 'You must have a confirmed registration to submit feedback.'}
          </span>
        </div>
      )}
    </div>
  );
}

export default FeedbackSystem;
