import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../components/Toast';
import { registrationsAPI, eventsAPI } from '../utils/api';
import { formatDate, getEventStatus } from '../utils/helpers';
import { EVENT_STATUS } from '../utils/constants';
import './ManageEventsPage.css';

const ManageEventsPage = () => {
  const { user } = useAuth();
  const { events, deleteEvent, updateEvent } = useData();
  const { showSuccess, showError } = useToast();

  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishingIds, setPublishingIds] = useState([]);
  const [closingIds, setClosingIds] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await registrationsAPI.getOrganizerRegistrations();
        if (res.success) {
          setRegistrations(res.data || res.registrations || []);
        }
      } catch (err) {
        console.error('Error fetching registrations', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Get organizer's events
  const myEvents = useMemo(() => {
    const organizerId = user?._id || user?.id;
    if (!organizerId) return [];
    return events.filter(event => {
      const orgId = event.organizer?._id || event.organizer || event.organizerId;
      return orgId === organizerId;
    });
  }, [events, user]);

  // Filter and search events
  const filteredEvents = useMemo(() => {
    let filtered = myEvents;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(event => getEventStatus(event.date) === filterStatus);
    }

    // Search by title or description
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search)
      );
    }

    // Sort by date (upcoming first, then by date ascending)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      const now = new Date();

      const aStatus = getEventStatus(a.date);
      const bStatus = getEventStatus(b.date);

      // Upcoming events first
      if (aStatus === EVENT_STATUS.UPCOMING && bStatus !== EVENT_STATUS.UPCOMING) return -1;
      if (bStatus === EVENT_STATUS.UPCOMING && aStatus !== EVENT_STATUS.UPCOMING) return 1;

      // Then ongoing
      if (aStatus === EVENT_STATUS.ONGOING && bStatus === EVENT_STATUS.PAST) return -1;
      if (bStatus === EVENT_STATUS.ONGOING && aStatus === EVENT_STATUS.PAST) return 1;

      // Within same status, sort by date
      return dateA - dateB;
    });
  }, [myEvents, filterStatus, searchTerm]);

  const handleDeleteClick = (event) => {
    setEventToDelete(event);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (eventToDelete) {
      deleteEvent(eventToDelete.id);
      showSuccess(`Event "${eventToDelete.title}" deleted successfully`);
      setShowDeleteModal(false);
      setEventToDelete(null);
    }
  };

  const handleCloseRegistrations = async (eventId) => {
    try {
      setClosingIds(prev => [...prev, eventId]);
      const response = await eventsAPI.update(eventId, { isClosed: true });
      if (!response.success) {
        showError(response.message || 'Failed to close registrations');
        return;
      }

      try {
        await updateEvent(eventId, { isClosed: true });
      } catch {
        // Local cache sync is best-effort only
      }

      showSuccess('Registrations closed for this event');
    } catch (error) {
      showError(error.message || 'Failed to close registrations');
    } finally {
      setClosingIds(prev => prev.filter(id => id !== eventId));
    }
  };

  const handlePublishDraft = async (eventId) => {
    try {
      setPublishingIds(prev => [...prev, eventId]);
      const response = await eventsAPI.publish(eventId);
      if (!response.success) {
        showError(response.message || 'Failed to publish event');
        return;
      }

      try {
        await updateEvent(eventId, { status: 'approved', lifecycleStatus: 'published' });
      } catch {
        // Local sync best-effort only
      }

      showSuccess('Event published successfully');
    } catch (error) {
      showError(error.message || 'Failed to publish event');
    } finally {
      setPublishingIds(prev => prev.filter(id => id !== eventId));
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setEventToDelete(null);
  };

  const getEventRegistrations = (eventId) => {
    return registrations.filter(reg => {
      const regEventId = (reg.event?._id || reg.event || reg.eventId)?.toString();
      return regEventId === eventId.toString();
    });
  };

  const renderEventCard = (event) => {
    const eventId = event._id || event.id;
    const eventRegs = getEventRegistrations(eventId);
    const status = getEventStatus(event.date);
    const reviewStatus = (event.status || '').toLowerCase();
    const isClosed = Boolean(event.isClosed);
    const pendingCount = eventRegs.filter(r => r.status === 'pending').length;
    const confirmedCount = eventRegs.filter(r => r.status === 'confirmed').length;

    return (
      <div key={eventId} className="manage-event-card">
        <div className="event-card-header">
          <div>
            <h3>{event.title}</h3>
            <p className="event-meta">
              {formatDate(event.date)} • {event.location}
            </p>
          </div>
          <span className={`status-badge ${status}`}>
            {status}
          </span>
        </div>

        <p className="event-description">{event.description}</p>

        <div className="event-stats">
          <div className="stat">
            <span className="stat-label">Total Registrations</span>
            <span className="stat-value">{eventRegs.length} / {event.maxParticipants}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Confirmed</span>
            <span className="stat-value confirmed">{confirmedCount}</span>
          </div>
          {pendingCount > 0 && (
            <div className="stat">
              <span className="stat-label">Pending</span>
              <span className="stat-value pending">{pendingCount}</span>
            </div>
          )}
          {isClosed && (
            <div className="stat">
              <span className="stat-label">Registrations</span>
              <span className="stat-value pending">Closed</span>
            </div>
          )}
        </div>

        <div className="event-card-actions">
          <Link to={`/event/${eventId}`} className="btn-outline">
            View
          </Link>
          <Link to={`/organizer/events/${eventId}/manage`} className="btn-primary-small">
            Manage Registrations
          </Link>
          {status === EVENT_STATUS.UPCOMING && (
            <>
              <Link to={`/organizer/checkin/${eventId}`} className="btn-success-small">
                📱 Check-In
              </Link>
              <Link to={`/organizer/events/edit/${eventId}`} className="btn-outline">
                Edit
              </Link>
              {!isClosed && (
                <button
                  className="btn-warning-small"
                  onClick={() => handleCloseRegistrations(eventId)}
                  disabled={closingIds.includes(eventId)}
                >
                  {closingIds.includes(eventId) ? 'Closing...' : 'Close Registrations'}
                </button>
              )}
            </>
          )}
          {reviewStatus === 'draft' && (
            <button
              className="btn-primary-small"
              onClick={() => handlePublishDraft(eventId)}
              disabled={publishingIds.includes(eventId)}
            >
              {publishingIds.includes(eventId) ? 'Publishing...' : 'Publish Draft'}
            </button>
          )}
          <button
            onClick={() => handleDeleteClick(event)}
            className="btn-danger-small"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="manage-events-page">
      <div className="page-header">
        <h1>Manage Events</h1>
        <Link to="/organizer/events/create" className="btn-primary">
          + Create Event
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All ({myEvents.length})
          </button>
          <button
            className={`filter-btn ${filterStatus === EVENT_STATUS.UPCOMING ? 'active' : ''}`}
            onClick={() => setFilterStatus(EVENT_STATUS.UPCOMING)}
          >
            Upcoming ({myEvents.filter(e => getEventStatus(e.date) === EVENT_STATUS.UPCOMING).length})
          </button>
          <button
            className={`filter-btn ${filterStatus === EVENT_STATUS.ONGOING ? 'active' : ''}`}
            onClick={() => setFilterStatus(EVENT_STATUS.ONGOING)}
          >
            Ongoing ({myEvents.filter(e => getEventStatus(e.date) === EVENT_STATUS.ONGOING).length})
          </button>
          <button
            className={`filter-btn ${filterStatus === EVENT_STATUS.PAST ? 'active' : ''}`}
            onClick={() => setFilterStatus(EVENT_STATUS.PAST)}
          >
            Past ({myEvents.filter(e => getEventStatus(e.date) === EVENT_STATUS.PAST).length})
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="events-container">
        {loading ? (
          <div className="empty-state"><p>Loading events...</p></div>
        ) : filteredEvents.length > 0 ? (
          filteredEvents.map(renderEventCard)
        ) : (
          <div className="empty-state">
            {searchTerm ? (
              <>
                <p>No events found matching "{searchTerm}"</p>
                <button onClick={() => setSearchTerm('')} className="btn-secondary">
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <p>No {filterStatus !== 'all' ? filterStatus : ''} events found</p>
                <Link to="/organizer/events/create" className="btn-primary">
                  Create Your First Event
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Event</h2>
            <p>
              Are you sure you want to delete "<strong>{eventToDelete?.title}</strong>"?
            </p>
            <p className="warning-text">
              This action cannot be undone. All registrations for this event will also be deleted.
            </p>
            <div className="modal-actions">
              <button onClick={handleCancelDelete} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} className="btn-danger">
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageEventsPage;
