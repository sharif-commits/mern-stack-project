import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toast.jsx';
import { formatDate, formatTime, getEventAvailability, getOrganizerName } from '../utils/helpers';
import { USER_ROLES, EVENT_TYPES } from '../utils/constants';
import { eventsAPI, registrationsAPI } from '../utils/api';
import TeamRegistrationForm from './TeamRegistrationForm.jsx';
import MerchandisePurchaseForm from './MerchandisePurchaseForm.jsx';
import DiscussionForum from './DiscussionForum.jsx';
import './EventDetails.css';

const normalizeEligibility = (eligibility) => {
  if (!eligibility) return 'All';
  const value = String(eligibility).trim().toLowerCase();

  if (
    value === 'all' ||
    value === 'both' ||
    value.includes('iiit+external') ||
    value.includes('iiit & external') ||
    value.includes('iiit and external')
  ) {
    return 'All';
  }

  if (value.includes('iiit')) {
    return value.includes('non') || value.includes('external') ? 'Non-IIIT' : 'IIIT';
  }

  if (value.includes('external') || value.includes('non')) {
    return 'Non-IIIT';
  }

  return 'All';
};

function EventDetails({ onRegister, onDelete }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showMerchModal, setShowMerchModal] = useState(false);
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myRegistration, setMyRegistration] = useState(null);
  const [customFieldResponses, setCustomFieldResponses] = useState({});

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        const response = await eventsAPI.getEventById(id);
        if (response.success) {
          setEvent(response.data);
        } else {
          setError(response.message || 'Event not found');
        }
      } catch (err) {
        console.error('Error fetching event:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  useEffect(() => {
    const fetchMyRegistration = async () => {
      if (!user || user.role !== USER_ROLES.PARTICIPANT || !event) {
        setMyRegistration(null);
        return;
      }

      try {
        const response = await registrationsAPI.getUserRegistrations();
        if (response.success) {
          const activeRegistration = (response.data || []).find(reg => {
            const regEventId = reg.event?._id || reg.eventId || reg.event;
            const regStatus = (reg.status || '').toLowerCase();
            return (
              regEventId?.toString() === (event._id || event.id)?.toString() &&
              regStatus !== 'rejected' &&
              regStatus !== 'cancelled'
            );
          });
          setMyRegistration(activeRegistration || null);
        }
      } catch (err) {
        console.error('Error fetching participant registrations:', err);
      }
    };

    fetchMyRegistration();
  }, [event, user]);

  if (loading) {
    return (
      <div className="event-details-container">
        <div className="loading">
          <p>Loading event details...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="event-details-container">
        <div className="not-found">
          <h2>Event Not Found</h2>
          <p>{error || "Sorry, we couldn't find the event you're looking for."}</p>
          <Link to="/" className="btn btn-primary">Back to Events</Link>
        </div>
      </div>
    );
  }

  const capacity = event.capacity || event.maxParticipants || 0;
  const registered = event.registered || 0;
  const merchVariants = event.merchandise?.variants || [];
  const merchStock = merchVariants.length > 0
    ? merchVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : (event.merchandise?.stock || 0);
  const isMerch = event.type === EVENT_TYPES.MERCHANDISE;
  const registrationMode =
    event.participantType === 'Both'
      ? 'Both'
      : event.participantType === 'Team' || event.allowTeams
        ? 'Team'
        : 'Individual';
  const hasRegistered = !isMerch && Boolean(myRegistration);
  const isFull = isMerch ? merchStock <= 0 : (registered >= capacity && capacity > 0);
  const isParticipant = user?.role === USER_ROLES.PARTICIPANT;
  const canManage = user?.role === USER_ROLES.ORGANIZER || user?.role === USER_ROLES.ADMIN;
  const availabilityStatus = getEventAvailability(event);
  const organizerDisplayName = getOrganizerName(event.organizer, event.organizerName);
  const deadlinePassed = event.registrationDeadline ? new Date(event.registrationDeadline) < new Date() : false;
  const normalizedEligibility = normalizeEligibility(event.eligibility);
  const isEligible = normalizedEligibility === 'All'
    || (normalizedEligibility === 'IIIT' && user?.participantType === 'IIIT')
    || (normalizedEligibility === 'Non-IIIT' && user?.participantType === 'Non-IIIT');
  const eligibilityLabel = normalizedEligibility === 'All'
    ? 'Both (IIIT + External)'
    : normalizedEligibility === 'Non-IIIT'
      ? 'External Only'
      : 'IIIT Only';

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      try {
        const response = await eventsAPI.deleteEvent(event._id || event.id);
        if (response.success) {
          showSuccess('Event deleted successfully');
          navigate('/');
        } else {
          showError(response.message || 'Failed to delete event');
        }
      } catch (err) {
        console.error('Error deleting event:', err);
        showError('Failed to delete event');
      }
    }
  };

  const handleRegister = async () => {
    if (!user) {
      showError('Please login to register');
      return;
    }

    if (hasRegistered) {
      showError('You are already registered for this event');
      return;
    }

    if (deadlinePassed) {
      showError('Registration deadline has passed');
      return;
    }
    if (!isEligible) {
      showError('You are not eligible for this event');
      return;
    }

    if (isMerch) {
      setShowMerchModal(true);
      return;
    }

    if (registrationMode === 'Team') {
      setShowTeamModal(true);
    } else if (registrationMode === 'Both') {
      setShowModeModal(true);
    } else {
      const hasCustomFields = Array.isArray(event.customFields) && event.customFields.length > 0;
      if (hasCustomFields) {
        setShowIndividualModal(true);
        return;
      }

      try {
        const response = await registrationsAPI.registerForEvent(event._id || event.id);
        if (response.success) {
          showSuccess('Successfully registered for event!');
          setMyRegistration(response.data || { eventId: event._id || event.id, status: 'confirmed' });
          // Refresh event data to show updated registration count
          const eventResponse = await eventsAPI.getEventById(id);
          if (eventResponse.success) {
            setEvent(eventResponse.data);
          }
        } else {
          showError(response.message || 'Failed to register for event');
        }
      } catch (err) {
        console.error('Error registering for event:', err);
        showError(err?.message || 'Failed to register for event');
      }
    }
  };

  const handleIndividualSubmit = async () => {
    if (hasRegistered) {
      showError('You are already registered for this event');
      return;
    }

    const fields = event.customFields || [];
    for (const field of fields) {
      const fieldKey = field.id || field._id || field.label;
      const value = customFieldResponses[fieldKey];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (field.required && isEmpty) {
        showError(`${field.label} is required`);
        return;
      }
    }

    try {
      const response = await registrationsAPI.registerForEvent(event._id || event.id, {
        customFields: customFieldResponses
      });
      if (response.success) {
        showSuccess('Successfully registered for event!');
        setMyRegistration(response.data || { eventId: event._id || event.id, status: 'confirmed' });
        setShowIndividualModal(false);
        setShowModeModal(false);
        const eventResponse = await eventsAPI.getEventById(id);
        if (eventResponse.success) {
          setEvent(eventResponse.data);
        }
      } else {
        showError(response.message || 'Failed to register for event');
      }
    } catch (err) {
      console.error('Error registering for event:', err);
      showError(err?.message || 'Failed to register for event');
    }
  };

  const handleTeamSubmit = async (teamData) => {
    try {
      const inviteEmails = (teamData.teamMembers || []).map(member => member.email).filter(Boolean);
      const response = await registrationsAPI.createTeamRegistration({
        eventId: event._id || event.id,
        teamName: teamData.teamName,
        desiredTeamSize: teamData.teamSize,
        inviteEmails
      });
      if (response.success) {
        showSuccess('Team created. Share invite links and track acceptances in your Teams dashboard.');
        setShowTeamModal(false);
        setShowModeModal(false);
        navigate('/dashboard/teams');
      } else {
        showError(response.message || 'Failed to create team registration');
      }
    } catch (err) {
      console.error('Error registering team:', err);
      showError(err?.message || 'Failed to create team registration');
    }
  };

  const handleMerchSubmit = async (payload) => {
    try {
      const response = await registrationsAPI.registerForEvent(event._id || event.id, payload);
      if (response.success) {
        const regData = response.data;
        const needsProof = regData?.paymentApprovalStatus === 'awaiting-proof';
        showSuccess(
          needsProof
            ? 'Order placed! Please upload your payment proof from your dashboard.'
            : 'Purchase successful! Ticket has been issued.'
        );
        setShowMerchModal(false);
        const eventResponse = await eventsAPI.getEventById(id);
        if (eventResponse.success) {
          setEvent(eventResponse.data);
        }
        navigate('/dashboard');
      } else {
        showError(response.message || 'Failed to complete purchase');
      }
    } catch (err) {
      console.error('Error purchasing merchandise:', err);
      showError(err?.message || 'Failed to complete purchase');
    }
  };

  return (
    <div className="event-details-container">
      <div className="details-card">
        <div className="details-header">
          <div className="header-top">
            <div className="badges-group">
              <span className={`category-badge ${event.category ? event.category.toLowerCase().replace(/\s/g, '-') : 'default'}`}>
                {event.category || 'Uncategorized'}
              </span>
              {event.type === EVENT_TYPES.MERCHANDISE ? (
                <span className="type-badge merchandise">Merchandise</span>
              ) : (
                <span className="type-badge">{event.type || 'Event'}</span>
              )}
            </div>
            <span className={`status-badge ${availabilityStatus.class}`}>
              {availabilityStatus.text}
            </span>
          </div>
          <h1 className="event-title">{event.title}</h1>
          <p className="event-organizer">
            <span className="icon">Organizer</span>
            Organized by <strong>{organizerDisplayName}</strong>
          </p>
        </div>

        <div className="details-body">
          {event.imageUrl && (
            <div className="event-image-wrapper">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="event-image"
                loading="lazy"
              />
            </div>
          )}

          <div className="info-grid">
            <div className="info-item">
              <div className="info-icon">Date</div>
              <div className="info-content">
                <span className="info-label">Date</span>
                <span className="info-value">{formatDate(event.date)}</span>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon">End</div>
              <div className="info-content">
                <span className="info-label">End Date</span>
                <span className="info-value">{formatDate(event.endDate || event.date)}</span>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon">Time</div>
              <div className="info-content">
                <span className="info-label">Time</span>
                <span className="info-value">{formatTime(event.time)}</span>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon">Location</div>
              <div className="info-content">
                <span className="info-label">Location</span>
                <span className="info-value">{event.location}</span>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon">Capacity</div>
              <div className="info-content">
                <span className="info-label">Capacity</span>
                <span className="info-value">{isMerch ? `${merchStock} in stock` : `${capacity} people`}</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">Eligibility</div>
              <div className="info-content">
                <span className="info-label">Eligibility</span>
                <span className="info-value">{eligibilityLabel}</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">Deadline</div>
              <div className="info-content">
                <span className="info-label">Registration Deadline</span>
                <span className="info-value">{formatDate(event.registrationDeadline || event.date)}</span>
              </div>
            </div>
          </div>

          <div className="description-section">
            <h3>About This Event</h3>
            <p className="event-description">{event.description}</p>
          </div>

          {isMerch && event.merchandise && (
            <div className="description-section">
              <h3>Merchandise Details</h3>
              <p>{event.merchandise.itemName}</p>
              {event.merchandise.description && <p>{event.merchandise.description}</p>}
              <p>Purchase Limit: {event.merchandise.purchaseLimit || 1}</p>
              {event.merchandise.sizes?.length > 0 && (
                <p>Sizes: {event.merchandise.sizes.join(', ')}</p>
              )}
              {event.merchandise.colors?.length > 0 && (
                <p>Colors: {event.merchandise.colors.join(', ')}</p>
              )}
            </div>
          )}

          <div className="registration-section">
            <h3>Registration Status</h3>
            <div className="progress-container">
              <div className="progress-bar-large">
                <div
                  className={`progress-fill ${availabilityStatus.class}`}
                  style={{ width: `${capacity > 0 ? (registered / capacity) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="progress-info">
                <span className="registered-count">
                  <strong>{registered}</strong> registered
                </span>
                <span className="available-count">
                  <strong>{Math.max(capacity - registered, 0)}</strong> spots remaining
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="details-footer">
          {isParticipant && (
            <button
              className="btn btn-primary btn-large"
              onClick={handleRegister}
              disabled={isFull || deadlinePassed || !isEligible || hasRegistered}
            >
              {hasRegistered
                ? 'Already Registered'
                : isFull
                  ? 'Sold Out'
                  : deadlinePassed
                    ? 'Deadline Passed'
                    : (!isEligible
                      ? 'Not Eligible'
                      : (isMerch
                        ? 'Purchase'
                        : (registrationMode === 'Team'
                          ? 'Register Team'
                          : (registrationMode === 'Both' ? 'Choose Registration Type' : 'Register for This Event'))))
              }
            </button>
          )}

          <div className="action-buttons">
            {user && (
              <>
                <Link to={`/forum/${event._id || event.id}`} className="btn btn-secondary">
                  Discussion
                </Link>
                <Link to={`/feedback/${event._id || event.id}`} className="btn btn-secondary">
                  Feedback
                </Link>
              </>
            )}
            {canManage && (
              <>
                <Link to={`/edit/${event._id || event.id}`} className="btn btn-secondary">
                  Edit Event
                </Link>
                <button onClick={handleDelete} className="btn btn-danger">
                  Delete Event
                </button>
              </>
            )}
            <Link to="/" className="btn btn-outline">
              Back to Events
            </Link>
          </div>
        </div>
      </div>

      {user && (
        <div className="event-discussion-section">
          <DiscussionForum eventId={event._id || event.id} embedded />
        </div>
      )}

      {/* Team Registration Modal */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="modal-content team-modal" onClick={e => e.stopPropagation()}>
            <TeamRegistrationForm
              event={event}
              onSubmit={handleTeamSubmit}
              onCancel={() => setShowTeamModal(false)}
            />
          </div>
        </div>
      )}

      {showModeModal && (
        <div className="modal-overlay" onClick={() => setShowModeModal(false)}>
          <div className="modal-content team-modal" onClick={e => e.stopPropagation()}>
            <div className="team-registration-form">
              <div className="form-header">
                <h2>Choose Registration Type</h2>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-submit"
                  onClick={() => {
                    setShowModeModal(false);
                    setShowIndividualModal(true);
                  }}
                >
                  Register as Individual
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  onClick={() => {
                    setShowModeModal(false);
                    setShowTeamModal(true);
                  }}
                >
                  Register as Team
                </button>
                <button type="button" className="btn-cancel" onClick={() => setShowModeModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIndividualModal && (
        <div className="modal-overlay" onClick={() => setShowIndividualModal(false)}>
          <div className="modal-content team-modal" onClick={e => e.stopPropagation()}>
            <div className="team-registration-form">
              <div className="form-header">
                <h2>Complete Registration</h2>
              </div>

              {Array.isArray(event.customFields) && event.customFields.length > 0 && (
                <div className="form-section">
                  <h3>Additional Information</h3>
                  {event.customFields.map((field) => {
                    const fieldKey = field.id || field._id || field.label;
                    const value = customFieldResponses[fieldKey];

                    if (field.type === 'textarea') {
                      return (
                        <div className="form-group" key={fieldKey}>
                          <label>{field.label}{field.required ? ' *' : ''}</label>
                          <textarea
                            rows="3"
                            value={value || ''}
                            onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                          />
                        </div>
                      );
                    }

                    if (field.type === 'select') {
                      return (
                        <div className="form-group" key={fieldKey}>
                          <label>{field.label}{field.required ? ' *' : ''}</label>
                          <select
                            value={value || ''}
                            onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                          >
                            <option value="">Select</option>
                            {(field.options || []).map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (field.type === 'radio') {
                      return (
                        <div className="form-group" key={fieldKey}>
                          <label>{field.label}{field.required ? ' *' : ''}</label>
                          {(field.options || []).map(option => (
                            <label key={option}>
                              <input
                                type="radio"
                                name={`custom-${fieldKey}`}
                                checked={value === option}
                                onChange={() => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: option }))}
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      );
                    }

                    if (field.type === 'checkbox') {
                      const selectedValues = Array.isArray(value) ? value : [];
                      return (
                        <div className="form-group" key={fieldKey}>
                          <label>{field.label}{field.required ? ' *' : ''}</label>
                          {(field.options || []).map(option => (
                            <label key={option}>
                              <input
                                type="checkbox"
                                checked={selectedValues.includes(option)}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...selectedValues, option]
                                    : selectedValues.filter(v => v !== option);
                                  setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: next }));
                                }}
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      );
                    }

                    if (field.type === 'file') {
                      return (
                        <div className="form-group" key={fieldKey}>
                          <label>{field.label}{field.required ? ' *' : ''}</label>
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: file ? file.name : '' }));
                            }}
                          />
                        </div>
                      );
                    }

                    return (
                      <div className="form-group" key={fieldKey}>
                        <label>{field.label}{field.required ? ' *' : ''}</label>
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
                          value={value || ''}
                          onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowIndividualModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-submit" onClick={handleIndividualSubmit}>
                  Register
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMerchModal && (
        <div className="modal-overlay" onClick={() => setShowMerchModal(false)}>
          <div className="modal-content team-modal" onClick={e => e.stopPropagation()}>
            <MerchandisePurchaseForm
              event={event}
              onSubmit={handleMerchSubmit}
              onCancel={() => setShowMerchModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default EventDetails;
