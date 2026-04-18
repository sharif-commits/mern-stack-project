import { useState, useMemo, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { adminAPI, eventsAPI } from '../utils/api';
import { formatDate, formatEventDate, getOrganizerName } from '../utils/helpers';
import './EventApproval.css';

const EventApproval = () => {
  const { showSuccess, showError } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [statusFilter, setStatusFilter] = useState('pending');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [eventToReject, setEventToReject] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await adminAPI.getAllEvents();
        if (res.success) {
          setEvents(res.data || []);
        } else {
          showError(res.message || 'Failed to load events');
        }
      } catch (err) {
        showError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [showError]);

  // Calculate statistics
  const stats = useMemo(() => {
    const pending = events.filter(e => e.status === 'pending').length;
    const approved = events.filter(e => e.status === 'approved').length;
    const rejected = events.filter(e => e.status === 'rejected').length;
    const total = events.length;
    
    return { pending, approved, rejected, total };
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesStatus = 
        statusFilter === 'all' || 
        event.status === statusFilter ||
        (statusFilter === 'pending' && (event.status === 'pending' || event.status === 'draft'));
      
      const matchesCategory = 
        categoryFilter === 'all' || 
        event.category?.toLowerCase() === categoryFilter.toLowerCase();
      
      const matchesSearch = 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [events, statusFilter, categoryFilter, searchTerm]);

  const handleViewDetails = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const handleApprove = async (event) => {
    try {
      const res = await eventsAPI.approve(event._id || event.id, 'approved');
      if (res.success) {
        setEvents(prev => prev.map(e => (e._id === event._id ? res.data : e)));
        showSuccess('Event approved successfully');
        setShowModal(false);
      } else {
        showError(res.message || 'Failed to approve event');
      }
    } catch (err) {
      showError('Failed to approve event');
    }
  };

  const handleRejectClick = (event) => {
    setEventToReject(event);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = () => {
    if (!rejectionReason.trim()) {
      showError('Please provide a reason for rejection');
      return;
    }

    eventsAPI.approve(eventToReject._id || eventToReject.id, 'rejected', rejectionReason)
      .then((res) => {
        if (res.success) {
          setEvents(prev => prev.map(e => (e._id === eventToReject._id ? res.data : e)));
          showSuccess('Event rejected');
        } else {
          showError(res.message || 'Failed to reject event');
        }
      })
      .catch(() => showError('Failed to reject event'))
      .finally(() => {
        setShowRejectModal(false);
        setShowModal(false);
        setEventToReject(null);
        setRejectionReason('');
      });
  };

  const handleRequestChanges = (event) => {
    showError('Change request workflow is not implemented in the backend');
  };

  return (
    <div className="event-approval">
      <div className="page-header">
        <h1>Event Approval</h1>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card pending">
          <h3>{stats.pending}</h3>
          <p>Pending Review</p>
        </div>
        <div className="stat-card approved">
          <h3>{stats.approved}</h3>
          <p>Approved</p>
        </div>
        <div className="stat-card rejected">
          <h3>{stats.rejected}</h3>
          <p>Rejected</p>
        </div>
        <div className="stat-card total">
          <h3>{stats.total}</h3>
          <p>Total Events</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filters-row">
          <div className="filter-group">
            <label>Status:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Category:</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="technical">Technical</option>
              <option value="cultural">Cultural</option>
              <option value="sports">Sports</option>
              <option value="workshop">Workshop</option>
              <option value="competition">Competition</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="events-grid">
        {loading ? (
          <div className="empty-state">
            <p>Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">
            <p>No events found</p>
          </div>
        ) : (
          filteredEvents.map(event => (
            <div key={event._id || event.id} className="event-card">
              <div className="event-header">
                <h3>{event.title}</h3>
                <span className={`status-badge status-${event.status}`}>
                  {event.status}
                </span>
              </div>
              
              <div className="event-info">
                <div className="info-item">
                  <span className="icon">🏢</span>
                  <span>{getOrganizerName(event.organizer, event.organizerName)}</span>
                </div>
                <div className="info-item">
                  <span className="icon">📅</span>
                  <span>{formatEventDate(event.date)}</span>
                </div>
                <div className="info-item">
                  <span className="icon">📍</span>
                  <span>{event.location}</span>
                </div>
                {event.category && (
                  <div className="info-item">
                    <span className="icon">🏷️</span>
                    <span className={`category-badge category-${event.category.toLowerCase()}`}>
                      {event.category}
                    </span>
                  </div>
                )}
              </div>

              <p className="event-description">{event.description}</p>

              <div className="event-actions">
                <button
                  className="btn-view"
                  onClick={() => handleViewDetails(event)}
                >
                  View Details
                </button>
                {event.status === 'pending' && (
                  <>
                    <button
                      className="btn-approve"
                      onClick={() => handleApprove(event)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => handleRejectClick(event)}
                    >
                      ✗ Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Event Details Modal */}
      {showModal && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent.title}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {/* Basic Information */}
              <div className="detail-section">
                <h3>Event Information</h3>
                <div className="detail-row">
                  <span className="label">Organizer:</span>
                  <span className="value">{getOrganizerName(selectedEvent.organizer, selectedEvent.organizerName)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Date:</span>
                  <span className="value">{formatEventDate(selectedEvent.date)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Location:</span>
                  <span className="value">{selectedEvent.location}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Category:</span>
                  <span className="value">
                    <span className={`category-badge category-${selectedEvent.category?.toLowerCase()}`}>
                      {selectedEvent.category}
                    </span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Type:</span>
                  <span className="value">{selectedEvent.type || 'General'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Capacity:</span>
                  <span className="value">{selectedEvent.capacity || selectedEvent.maxParticipants || 'Unlimited'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Status:</span>
                  <span className="value">
                    <span className={`status-badge status-${selectedEvent.status}`}>
                      {selectedEvent.status}
                    </span>
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="detail-section">
                <h3>Description</h3>
                <p className="description-text">{selectedEvent.description}</p>
              </div>

              {/* Additional Settings */}
              <div className="detail-section">
                <h3>Settings</h3>
                <div className="settings-grid">
                  <div className="setting-item">
                    <span className={selectedEvent.requiresApproval ? 'setting-enabled' : 'setting-disabled'}>
                      {selectedEvent.requiresApproval ? '✓' : '✗'}
                    </span>
                    <span>Requires Approval</span>
                  </div>
                  <div className="setting-item">
                    <span className={selectedEvent.allowTeams ? 'setting-enabled' : 'setting-disabled'}>
                      {selectedEvent.allowTeams ? '✓' : '✗'}
                    </span>
                    <span>Allow Teams</span>
                  </div>
                  <div className="setting-item">
                    <span className={selectedEvent.requiresPayment ? 'setting-enabled' : 'setting-disabled'}>
                      {selectedEvent.requiresPayment ? '✓' : '✗'}
                    </span>
                    <span>Requires Payment</span>
                  </div>
                </div>
                {selectedEvent.requiresPayment && selectedEvent.paymentAmount && (
                  <div className="payment-info">
                    <strong>Payment Amount:</strong> ₹{selectedEvent.paymentAmount}
                  </div>
                )}
              </div>

              {/* Custom Fields */}
              {selectedEvent.customFields && selectedEvent.customFields.length > 0 && (
                <div className="detail-section">
                  <h3>Custom Registration Fields ({selectedEvent.customFields.length})</h3>
                  <div className="custom-fields-list">
                    {selectedEvent.customFields.map((field, index) => (
                      <div key={index} className="custom-field-item">
                        <strong>{field.label}</strong>
                        <span className="field-type">({field.type})</span>
                        {field.required && <span className="required-badge">Required</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection Reason */}
              {selectedEvent.status === 'rejected' && selectedEvent.rejectionReason && (
                <div className="detail-section rejection-section">
                  <h3>Rejection Reason</h3>
                  <p className="rejection-text">{selectedEvent.rejectionReason}</p>
                  <p className="rejection-date">
                    Rejected on {formatDate(selectedEvent.rejectedAt)}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              {selectedEvent.status === 'pending' && (
                <>
                  <button
                    className="btn-changes"
                    onClick={() => handleRequestChanges(selectedEvent)}
                  >
                    Request Changes
                  </button>
                  <button
                    className="btn-approve-modal"
                    onClick={() => handleApprove(selectedEvent)}
                  >
                    Approve Event
                  </button>
                  <button
                    className="btn-reject-modal"
                    onClick={() => handleRejectClick(selectedEvent)}
                  >
                    Reject Event
                  </button>
                </>
              )}
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && eventToReject && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Event</h2>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <p>You are about to reject: <strong>{eventToReject.title}</strong></p>
              <div className="form-group">
                <label>Reason for rejection: *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this event is being rejected..."
                  rows="4"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleRejectConfirm}>
                Reject Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventApproval;
