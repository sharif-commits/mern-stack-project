import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { registrationsAPI } from '../utils/api';
import { formatDateShort, formatTime, getDaysUntilEvent, getOrganizerName } from '../utils/helpers';
import { REGISTRATION_STATUS, EVENT_TYPES } from '../utils/constants';
import { useToast } from '../components/Toast.jsx';
import './ParticipantDashboard.css';

const getPaymentProofUrl = (proofPath) => {
  if (!proofPath) return '';
  if (/^https?:\/\//i.test(proofPath)) return proofPath;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  let origin = 'http://localhost:5000';
  try { origin = new URL(apiBase).origin; } catch (_) { /* fallback */ }
  const normalizedPath = proofPath.startsWith('/') ? proofPath : `/${proofPath}`;
  return `${origin}${normalizedPath}`;
};

function ParticipantDashboard() {
  const { user } = useAuth();
  const { events } = useData();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        const response = await registrationsAPI.getUserRegistrations();
        if (response.success) {
          setRegistrations(response.data || []);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching registrations:', err);
        setError('Failed to load registrations');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchRegistrations();
    }
  }, [user]);

  const userRegistrations = useMemo(() => {
    return registrations;
  }, [registrations]);

  const upcomingEvents = useMemo(() => {
    const allowedStatuses = [
      REGISTRATION_STATUS.CONFIRMED,
      REGISTRATION_STATUS.PENDING,
      REGISTRATION_STATUS.APPROVED,
    ];
    return userRegistrations
      .filter(reg => {
        const event = events.find(e => (e._id || e.id) === (reg.eventId || reg.event?._id || reg.event?.id));
        return event && new Date(event.date) >= new Date() && allowedStatuses.includes((reg.status || '').toLowerCase());
      })
      .map(reg => ({
        ...reg,
        event: events.find(e => (e._id || e.id) === (reg.eventId || reg.event?._id || reg.event?.id)) || reg.event
      }))
      .sort((a, b) => new Date(a.event.date) - new Date(b.event.date));
  }, [userRegistrations, events]);

  const categorizedRegistrations = useMemo(() => {
    const normal = [];
    const merchandise = [];
    const completed = [];
    const cancelled = [];

    userRegistrations.forEach(reg => {
      const event = events.find(e => (e._id || e.id) === (reg.eventId || reg.event?._id || reg.event?.id)) || reg.event;
      if (!event) return;

      const registration = { ...reg, event };

      const status = (reg.status || '').toLowerCase();
      if (status === REGISTRATION_STATUS.CANCELLED || status === REGISTRATION_STATUS.REJECTED) {
        cancelled.push(registration);
      } else if (new Date(event.date) < new Date() || status === REGISTRATION_STATUS.COMPLETED) {
        completed.push(registration);
      } else if (event.type === EVENT_TYPES.MERCHANDISE) {
        merchandise.push(registration);
      } else {
        normal.push(registration);
      }
    });

    return { normal, merchandise, completed, cancelled };
  }, [userRegistrations, events]);

  const stats = {
    total: upcomingEvents.length,
    thisWeek: upcomingEvents.filter(e => getDaysUntilEvent(e.event.date) <= 7).length,
    thisMonth: upcomingEvents.filter(e => getDaysUntilEvent(e.event.date) <= 30).length,
  };

  const handleUploadProof = async (registrationId, file) => {
    try {
      setUploadingId(registrationId);
      const res = await registrationsAPI.uploadPaymentProof(registrationId, file);
      if (res.success) {
        setRegistrations(prev => prev.map(r => (r._id === registrationId || r.id === registrationId ? res.data : r)));
        showSuccess('Payment proof uploaded');
      }
    } catch (err) {
      showError(err.message || 'Failed to upload payment proof');
    } finally {
      setUploadingId(null);
    }
  };

  const renderEventCard = (registration) => {
    const { event } = registration;
    if (!event) return null;

    const daysUntil = getDaysUntilEvent(event.date);

    return (
      <div key={registration._id || registration.id} className="dashboard-event-card">
        <div className="event-card-left">
          <div className="event-date-badge">
            <div className="date-day">{new Date(event.date).getDate()}</div>
            <div className="date-month">
              {formatDateShort(event.date)}
            </div>
          </div>
        </div>
        <div className="event-card-content">
          <div className="event-card-header">
            <div>
              <Link to={`/event/${event._id || event.id}`} className="event-title-link">
                <h3>{event.title}</h3>
              </Link>
              <p className="event-organizer">{getOrganizerName(event.organizer, event.organizerName)}</p>
            </div>
            <div className="event-badges">
              {event.type === EVENT_TYPES.MERCHANDISE && (
                <span className="badge badge-merchandise">Merchandise</span>
              )}
              <span className={`badge badge-${registration.status.toLowerCase()}`}>
                {registration.status}
              </span>
            </div>
          </div>
          <div className="event-meta">
            <span>⏰ {formatTime(event.time)}</span>
            <span>📍 {event.location}</span>
            {daysUntil >= 0 && (
              <span className="days-until">
                {daysUntil === 0 ? '🔥 Today!' : `📅 ${daysUntil} days`}
              </span>
            )}
            {registration.isTeam && registration.teamName && (
              <span className="team-name">👥 {registration.teamName}</span>
            )}
          </div>
          <div className="event-ticket-info">
            <Link to={`/ticket/${registration._id || registration.id}`} className="ticket-id">
              Ticket: {registration.ticketId}
            </Link>
            <Link to={`/event/${event._id || event.id}`} className="view-details-link">
              View Details →
            </Link>
          </div>
          {event.type === EVENT_TYPES.MERCHANDISE && registration.paymentAmount > 0 && (
            <div className="payment-proof-section">
              {registration.paymentApprovalStatus === 'awaiting-proof' && (
                <div className="payment-proof awaiting">
                  <span className="proof-status-badge awaiting">⚠️ Awaiting Payment Proof</span>
                  <label className="upload-label">
                    {uploadingId === (registration._id || registration.id) ? 'Uploading...' : 'Upload Screenshot'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadProof(registration._id || registration.id, file);
                      }}
                      disabled={uploadingId === (registration._id || registration.id)}
                    />
                  </label>
                  <p className="proof-hint">Upload your UPI / bank transfer screenshot to proceed</p>
                </div>
              )}
              {registration.paymentApprovalStatus === 'pending' && (
                <div className="payment-proof submitted">
                  <span className="proof-status-badge pending">🕐 Proof Submitted — Awaiting Organizer Approval</span>
                  {registration.paymentScreenshot && (
                    <a href={getPaymentProofUrl(registration.paymentScreenshot)} target="_blank" rel="noreferrer" className="proof-thumbnail-link">
                      View uploaded proof ↗
                    </a>
                  )}
                </div>
              )}
              {registration.paymentApprovalStatus === 'approved' && (
                <span className="proof-status-badge approved">✅ Payment Approved</span>
              )}
              {registration.paymentApprovalStatus === 'rejected' && (
                <div className="payment-proof rejected">
                  <span className="proof-status-badge rejected">❌ Payment Rejected — Re-upload Proof</span>
                  <label className="upload-label">
                    {uploadingId === (registration._id || registration.id) ? 'Uploading...' : 'Re-upload Screenshot'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadProof(registration._id || registration.id, file);
                      }}
                      disabled={uploadingId === (registration._id || registration.id)}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="participant-dashboard">
      <div className="dashboard-header">
        <h1>My Dashboard</h1>
        <p className="subtitle">Welcome back, {user?.firstName}! Track your events and registrations</p>
      </div>

      {loading && (
        <div className="loading">Loading your registrations...</div>
      )}

      {error && !loading && (
        <div className="error-banner">{error}</div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🎫</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Upcoming Events</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.thisWeek}</div>
            <div className="stat-label">This Week</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.thisMonth}</div>
            <div className="stat-label">This Month</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <div className="stat-value">{categorizedRegistrations.completed.length}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Upcoming Events</h2>
        {upcomingEvents.length === 0 ? (
          <div className="empty-state">
            <p>📭 No upcoming events registered</p>
            <Link to="/events" className="btn btn-primary">Browse Events</Link>
          </div>
        ) : (
          <div className="events-list">
            {upcomingEvents.map(renderEventCard)}
          </div>
        )}
      </div>

      <div className="dashboard-section">
        <h2>Participation History</h2>
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Normal ({categorizedRegistrations.normal.length})
          </button>
          <button
            className={`tab ${activeTab === 'merchandise' ? 'active' : ''}`}
            onClick={() => setActiveTab('merchandise')}
          >
            Merchandise ({categorizedRegistrations.merchandise.length})
          </button>
          <button
            className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed ({categorizedRegistrations.completed.length})
          </button>
          <button
            className={`tab ${activeTab === 'cancelled' ? 'active' : ''}`}
            onClick={() => setActiveTab('cancelled')}
          >
            Cancelled/Rejected ({categorizedRegistrations.cancelled.length})
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'upcoming' && (
            <div className="events-list">
              {categorizedRegistrations.normal.length === 0 ? (
                <p className="empty-message">No normal events registered</p>
              ) : (
                categorizedRegistrations.normal.map(renderEventCard)
              )}
            </div>
          )}
          {activeTab === 'merchandise' && (
            <div className="events-list">
              {categorizedRegistrations.merchandise.length === 0 ? (
                <p className="empty-message">No merchandise orders</p>
              ) : (
                categorizedRegistrations.merchandise.map(renderEventCard)
              )}
            </div>
          )}
          {activeTab === 'completed' && (
            <div className="events-list">
              {categorizedRegistrations.completed.length === 0 ? (
                <p className="empty-message">No completed events</p>
              ) : (
                categorizedRegistrations.completed.map(renderEventCard)
              )}
            </div>
          )}
          {activeTab === 'cancelled' && (
            <div className="events-list">
              {categorizedRegistrations.cancelled.length === 0 ? (
                <p className="empty-message">No cancelled registrations</p>
              ) : (
                categorizedRegistrations.cancelled.map(renderEventCard)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ParticipantDashboard;
