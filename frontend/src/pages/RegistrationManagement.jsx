import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { registrationsAPI } from '../utils/api';
import { formatDate, formatTime } from '../utils/helpers';
import './RegistrationManagement.css';

const RegistrationManagement = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { events } = useData();
  const { showSuccess, showError } = useToast();

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterAttendance, setFilterAttendance] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('registrations');
  const [processingPaymentId, setProcessingPaymentId] = useState(null);

  const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        setLoading(true);
        const response = eventId
          ? await registrationsAPI.getEventRegistrations(eventId)
          : await registrationsAPI.getOrganizerRegistrations();

        if (response.success) {
          const data = response.data || response.registrations || [];
          setRegistrations(data);
        } else {
          showError(response.message || 'Failed to load registrations');
        }
      } catch (err) {
        console.error('Error fetching registrations:', err);
        showError('Failed to load registrations');
      } finally {
        setLoading(false);
      }
    };

    fetchRegistrations();
  }, [eventId]);

  // Get organizer's events
  const organizerEvents = useMemo(() => {
    if (!user?._id && !user?.id) return [];
    return events.filter(e => {
      const organizerId = e.organizer?._id || e.organizer || e.organizerId;
      return organizerId === user._id || organizerId === user.id;
    });
  }, [events, user]);

  const event = eventId ? events.find(e => e.id == eventId || e._id == eventId) : null;

  const eventRegistrations = useMemo(() => {
    return registrations
      .slice()
      .sort((a, b) => new Date(b.registeredAt || b.createdAt) - new Date(a.registeredAt || a.createdAt));
  }, [registrations]);

  const filteredRegistrations = useMemo(() => {
    let filtered = eventRegistrations;

    // Filter by event when showing all registrations
    if (!eventId && selectedEventFilter !== 'all') {
      filtered = filtered.filter(reg => {
        const regEventId = (reg.event?._id || reg.eventId || reg.event)?.toString();
        return regEventId === selectedEventFilter;
      });
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(reg => reg.status === filterStatus);
    }

    if (filterPayment !== 'all') {
      filtered = filtered.filter(reg => reg.paymentStatus === filterPayment);
    }

    if (filterAttendance !== 'all') {
      filtered = filtered.filter(reg => (filterAttendance === 'checked-in' ? reg.checkedIn : !reg.checkedIn));
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(reg =>
        (reg.participantName?.toLowerCase() || '').includes(search) ||
        (reg.email?.toLowerCase() || '').includes(search)
      );
    }

    return filtered;
  }, [eventRegistrations, filterStatus, filterPayment, filterAttendance, searchTerm, selectedEventFilter, eventId]);

  const stats = useMemo(() => {
    const total = eventRegistrations.length;
    const pending = eventRegistrations.filter(r => r.status === 'pending').length;
    const confirmed = eventRegistrations.filter(r => r.status === 'confirmed' || r.status === 'approved').length;
    const rejected = eventRegistrations.filter(r => r.status === 'rejected').length;

    return { total, pending, confirmed, rejected };
  }, [eventRegistrations]);

  const analytics = useMemo(() => {
    if (!eventId) return null;
    const total = eventRegistrations.length;
    const sales = eventRegistrations.filter(r => ['paid', 'free'].includes(r.paymentStatus)).length;
    const revenue = eventRegistrations.reduce((sum, reg) => sum + (reg.amountPaid || 0), 0);
    const attendance = eventRegistrations.filter(reg => reg.checkedIn).length;
    const teamRegistrations = eventRegistrations.filter(reg => reg.isTeam);
    const minTeamSize = event?.minTeamSize || 0;
    const completedTeams = teamRegistrations.filter(reg => (reg.teamMembers?.length || 0) + 1 >= minTeamSize);

    return {
      total,
      sales,
      revenue,
      attendance,
      teamCompletion: teamRegistrations.length > 0
        ? Math.round((completedTeams.length / teamRegistrations.length) * 100)
        : 0
    };
  }, [eventId, eventRegistrations, event]);

  const eventOverview = useMemo(() => {
    if (!eventId || !event) return null;
    const statusLabel = event.lifecycleStatus || event.status || 'published';
    const priceValue = event.registrationFee || 0;
    const priceLabel = priceValue > 0 ? `₹${priceValue}` : 'Free';
    const startDate = formatDate(event.date);
    const endDate = event.endDate ? formatDate(event.endDate) : startDate;
    const timeLabel = event.time ? formatTime(event.time) : 'TBD';

    return {
      name: event.title,
      type: event.type || 'Event',
      status: statusLabel,
      dates: `${startDate} - ${endDate}`,
      time: timeLabel,
      eligibility: event.eligibility || 'All',
      pricing: priceLabel
    };
  }, [eventId, event]);

  const handleApprove = async (registrationId) => {
    try {
      const response = await registrationsAPI.updateRegistrationStatus(registrationId, 'confirmed');
      if (response.success) {
        const updated = response.data || response.registration;
        setRegistrations(prev =>
          prev.map(reg => (reg._id === registrationId || reg.id === registrationId ? updated : reg))
        );
        showSuccess('Registration confirmed successfully');
      } else {
        showError(response.message || 'Failed to confirm registration');
      }
    } catch (err) {
      console.error('Error confirming registration:', err);
      showError('Failed to confirm registration');
    }
  };

  const handleReject = async (registrationId) => {
    try {
      const response = await registrationsAPI.updateRegistrationStatus(registrationId, 'rejected');
      if (response.success) {
        const updated = response.data || response.registration;
        setRegistrations(prev =>
          prev.map(reg => (reg._id === registrationId || reg.id === registrationId ? updated : reg))
        );
        showSuccess('Registration rejected');
      } else {
        showError(response.message || 'Failed to reject registration');
      }
    } catch (err) {
      console.error('Error rejecting registration:', err);
      showError('Failed to reject registration');
    }
  };

  const handleViewDetails = (registration) => {
    setSelectedRegistration(registration);
    setShowDetailsModal(true);
  };

  const handleApprovePayment = async (registrationId) => {
    try {
      setProcessingPaymentId(registrationId);
      const response = await registrationsAPI.updatePayment(registrationId, {
        paymentStatus: 'paid',
        paymentApprovalStatus: 'approved'
      });
      if (response.success) {
        const updated = response.data;
        setRegistrations(prev =>
          prev.map(reg => (reg._id === registrationId || reg.id === registrationId ? updated : reg))
        );
        showSuccess('Payment approved — ticket generated and email sent');
      } else {
        showError(response.message || 'Failed to approve payment');
      }
    } catch (err) {
      showError(err.message || 'Failed to approve payment');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const handleRejectPayment = async (registrationId) => {
    try {
      setProcessingPaymentId(registrationId);
      const response = await registrationsAPI.updatePayment(registrationId, {
        paymentStatus: 'failed',
        paymentApprovalStatus: 'rejected'
      });
      if (response.success) {
        const updated = response.data;
        setRegistrations(prev =>
          prev.map(reg => (reg._id === registrationId || reg.id === registrationId ? updated : reg))
        );
        showSuccess('Payment rejected');
      } else {
        showError(response.message || 'Failed to reject payment');
      }
    } catch (err) {
      showError(err.message || 'Failed to reject payment');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  // Orders where participant has uploaded proof and is awaiting organizer review
  const pendingPaymentProofs = registrations.filter(
    reg => reg.paymentApprovalStatus === 'pending' && reg.paymentScreenshot
  );

  const handleResendTicket = async (registrationId) => {
    try {
      const response = await registrationsAPI.resendTicket(registrationId);
      if (response.success) {
        showSuccess('Ticket email sent successfully');
      } else {
        showError(response.message || 'Failed to resend ticket email');
      }
    } catch (err) {
      console.error('Error resending ticket email:', err);
      showError(err.message || 'Failed to resend ticket email');
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Status', 'Payment', 'Amount Paid', 'Team', 'Attendance', 'Registered At', 'Event', 'Custom Fields'].join(','),
      ...filteredRegistrations.map(reg => [
        reg.participantName,
        reg.email,
        reg.phone || '',
        reg.status,
        reg.paymentStatus || '',
        reg.amountPaid || 0,
        reg.isTeam ? (reg.teamName || 'Team') : 'Individual',
        reg.checkedIn ? 'Yes' : 'No',
        new Date(reg.registeredAt || reg.createdAt).toLocaleString(),
        reg.event?.title || event?.title || '',
        JSON.stringify(reg.customFieldResponses || {})
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(event?.title || 'registrations').replace(/\s+/g, '_')}_registrations.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showSuccess('Registration data exported successfully');
  };

  if (eventId && !event) {
    return (
      <div className="registration-management">
        <div className="error-state">
          <h2>Event Not Found</h2>
          <button onClick={() => navigate('/organizer/events')} className="btn-primary">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="registration-management">
      {/* Main tab navigation */}
      <div className="page-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          className={`tab-btn${activeTab === 'registrations' ? ' active' : ''}`}
          style={{ padding: '0.5rem 1.25rem', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontWeight: activeTab === 'registrations' ? 700 : 400, background: activeTab === 'registrations' ? '#6366f1' : 'transparent', color: activeTab === 'registrations' ? '#fff' : '#64748b' }}
          onClick={() => setActiveTab('registrations')}
        >
          Registrations
        </button>
        <button
          className={`tab-btn${activeTab === 'paymentProofs' ? ' active' : ''}`}
          style={{ padding: '0.5rem 1.25rem', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontWeight: activeTab === 'paymentProofs' ? 700 : 400, background: activeTab === 'paymentProofs' ? '#6366f1' : 'transparent', color: activeTab === 'paymentProofs' ? '#fff' : '#64748b', position: 'relative' }}
          onClick={() => setActiveTab('paymentProofs')}
        >
          💳 Payment Proofs
          {pendingPaymentProofs.length > 0 && (
            <span style={{ marginLeft: '0.4rem', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.7rem', padding: '1px 7px', fontWeight: 700 }}>
              {pendingPaymentProofs.length}
            </span>
          )}
        </button>
      </div>
      {activeTab === 'registrations' && (
        <div className="registrations-tab-content">
          <div className="page-header">
            <div>
              {eventId && (
                <button onClick={() => navigate(-1)} className="back-button">
                  ← Back
                </button>
              )}
              <h1>{event ? event.title : 'All Registrations'}</h1>
              {event && (
                <p className="event-info">
                  {formatDate(event.date)} • {event.location}
                </p>
              )}
            </div>
            <button onClick={handleExport} className="btn-export">
              📥 Export Data
            </button>
          </div>

          {eventOverview && (
            <div className="overview-section">
              <h2>Event Overview</h2>
              <div className="overview-grid">
                <div className="overview-card">
                  <span className="overview-label">Name</span>
                  <span className="overview-value">{eventOverview.name}</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Type</span>
                  <span className="overview-value">{eventOverview.type}</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Status</span>
                  <span className="overview-value">{eventOverview.status}</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Dates</span>
                  <span className="overview-value">{eventOverview.dates}</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Time</span>
                  <span className="overview-value">{eventOverview.time}</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Eligibility</span>
                  <span className="overview-value">{eventOverview.eligibility}</span>
                </div>
                <div className="overview-card">
                  <span className="overview-label">Pricing</span>
                  <span className="overview-value">{eventOverview.pricing}</span>
                </div>
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="stats-grid">
            <div className="stat-card">
              <h3>{stats.total}</h3>
              <p>Total Registrations</p>
            </div>
            <div className="stat-card pending">
              <h3>{stats.pending}</h3>
              <p>Pending Approval</p>
            </div>
            <div className="stat-card confirmed">
              <h3>{stats.confirmed}</h3>
              <p>Confirmed</p>
            </div>
            <div className="stat-card rejected">
              <h3>{stats.rejected}</h3>
              <p>Rejected</p>
            </div>
          </div>

          {analytics && (
            <div className="analytics-section">
              <h2>Event Analytics</h2>
              <div className="analytics-grid">
                <div className="stat-card">
                  <h3>{analytics.sales}</h3>
                  <p>Registrations / Sales</p>
                </div>
                <div className="stat-card">
                  <h3>{analytics.attendance}</h3>
                  <p>Attendance</p>
                </div>
                <div className="stat-card">
                  <h3>{analytics.teamCompletion}%</h3>
                  <p>Team Completion</p>
                </div>
                <div className="stat-card">
                  <h3>₹{analytics.revenue}</h3>
                  <p>Revenue</p>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="filters-section">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="event-filter">
              <label>Payment:</label>
              <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="free">Free</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="event-filter">
              <label>Attendance:</label>
              <select value={filterAttendance} onChange={(e) => setFilterAttendance(e.target.value)}>
                <option value="all">All</option>
                <option value="checked-in">Checked In</option>
                <option value="not-checked-in">Not Checked In</option>
              </select>
            </div>
            {!eventId && organizerEvents.length > 0 && (
              <div className="event-filter">
                <label>Filter by Event:</label>
                <select value={selectedEventFilter} onChange={(e) => setSelectedEventFilter(e.target.value)}>
                  <option value="all">All Events</option>
                  {organizerEvents.map(evt => (
                    <option key={evt._id || evt.id} value={evt._id || evt.id}>{evt.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All ({stats.total})
              </button>
              <button
                className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
                onClick={() => setFilterStatus('pending')}
              >
                Pending ({stats.pending})
              </button>
              <button
                className={`filter-btn ${filterStatus === 'confirmed' ? 'active' : ''}`}
                onClick={() => setFilterStatus('confirmed')}
              >
                Confirmed ({stats.confirmed})
              </button>
              <button
                className={`filter-btn ${filterStatus === 'rejected' ? 'active' : ''}`}
                onClick={() => setFilterStatus('rejected')}
              >
                Rejected ({stats.rejected})
              </button>
            </div>
          </div>

          {/* Registrations Table */}
          <div className="registrations-table-container">
            {filteredRegistrations.length > 0 ? (
              <table className="registrations-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    {!eventId && <th>Event</th>}
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Payment</th>
                    <th>Team</th>
                    <th>Attendance</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistrations.map(registration => {
                    const regEvent = registration.event || events.find(e => e.id === registration.eventId || e.id === registration.event);
                    const teamSize = registration.isTeam ? (registration.teamMembers?.length || 0) + 1 : 1;
                    return (
                      <tr key={registration._id || registration.id}>
                        <td>
                          <div className="participant-info">
                            <strong>{registration.participantName}</strong>
                            {registration.isTeam && (
                              <span className="team-badge">Team</span>
                            )}
                          </div>
                        </td>
                        {!eventId && <td>{regEvent?.title || 'Unknown Event'}</td>}
                        <td>{registration.email}</td>
                        <td>{registration.phone || '-'}</td>
                        <td>
                          <span className={`status-badge ${registration.paymentStatus || 'pending'}`}>
                            {registration.paymentStatus || 'pending'}
                          </span>
                        </td>
                        <td>{registration.isTeam ? `${registration.teamName || 'Team'} (${teamSize})` : 'Individual'}</td>
                        <td>
                          <span className={`status-badge ${registration.checkedIn ? 'approved' : 'pending'}`}>
                            {registration.checkedIn ? 'Checked In' : 'Not Checked In'}
                          </span>
                        </td>
                        <td>{formatDate(registration.registeredAt || registration.createdAt)}</td>
                        <td>
                          <span className={`status-badge ${registration.status}`}>
                            {registration.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              onClick={() => handleViewDetails(registration)}
                              className="btn-view"
                              title="View Details"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => handleResendTicket(registration._id || registration.id)}
                              className="btn-mail"
                              title="Resend Ticket"
                            >
                              📧
                            </button>
                            {registration.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(registration._id || registration.id)}
                                  className="btn-approve"
                                  title="Approve"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => handleReject(registration._id || registration.id)}
                                  className="btn-reject"
                                  title="Reject"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                {searchTerm ? (
                  <>
                    <p>No registrations found matching "{searchTerm}"</p>
                    <button onClick={() => setSearchTerm('')} className="btn-secondary">
                      Clear Search
                    </button>
                  </>
                ) : (
                  <p>No {filterStatus !== 'all' ? filterStatus : ''} registrations yet</p>
                )}
              </div>
            )}
          </div>

          {/* Details Modal */}
          {showDetailsModal && selectedRegistration && (
            <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Registration Details</h2>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="modal-close"
                  >
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="detail-section">
                    <h3>Participant Information</h3>
                    <div className="detail-row">
                      <span className="label">Name:</span>
                      <span className="value">{selectedRegistration.participantName}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Email:</span>
                      <span className="value">{selectedRegistration.email}</span>
                    </div>
                    {selectedRegistration.phone && (
                      <div className="detail-row">
                        <span className="label">Phone:</span>
                        <span className="value">{selectedRegistration.phone}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">Registered:</span>
                      <span className="value">{formatDate(selectedRegistration.registrationDate || selectedRegistration.registeredAt || selectedRegistration.createdAt)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Status:</span>
                      <span className={`status-badge ${selectedRegistration.status}`}>
                        {selectedRegistration.status}
                      </span>
                    </div>

                    {selectedRegistration.ticketQr && (
                      <div className="detail-section">
                        <h3>Ticket QR</h3>
                        <img src={selectedRegistration.ticketQr} alt="Ticket QR" className="ticket-qr" />
                      </div>
                    )}
                  </div>

                  {selectedRegistration.isTeam && selectedRegistration.teamMembers && (
                    <div className="detail-section">
                      <h3>Team Members</h3>
                      {selectedRegistration.teamMembers.map((member, index) => (
                        <div key={index} className="team-member">
                          <strong>{member.name}</strong>
                          <span>{member.email}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedRegistration.customFieldResponses &&
                    Object.keys(selectedRegistration.customFieldResponses).length > 0 && (
                      <div className="detail-section">
                        <h3>Additional Information</h3>
                        {Object.entries(selectedRegistration.customFieldResponses).map(
                          ([fieldId, value]) => {
                            const field = event?.customFields?.find(f => {
                              if (!f) return false;
                              return f.id === fieldId || f._id === fieldId || String(f._id) === String(fieldId) || String(f.id) === String(fieldId) || f.label === fieldId;
                            });
                            return (
                              <div key={fieldId} className="detail-row">
                                <span className="label">{field?.label || fieldId}:</span>
                                <span className="value">
                                  {Array.isArray(value) ? value.join(', ') : value}
                                </span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                </div>

                <div className="modal-actions">
                  {selectedRegistration.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          handleApprove(selectedRegistration._id || selectedRegistration.id);
                          setShowDetailsModal(false);
                        }}
                        className="btn-primary"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          handleReject(selectedRegistration._id || selectedRegistration.id);
                          setShowDetailsModal(false);
                        }}
                        className="btn-danger"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleResendTicket(selectedRegistration._id || selectedRegistration.id)}
                    className="btn-secondary"
                  >
                    Resend Ticket Email
                  </button>
                  <button onClick={() => setShowDetailsModal(false)} className="btn-secondary">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Payment Proofs Tab */}
      {activeTab === 'paymentProofs' && (
        <div className="payment-proofs-section">
          <h2 style={{ marginBottom: '1rem' }}>Merchandise Payment Proofs</h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            Orders below have uploaded payment screenshots and are awaiting your approval.
            Approving generates a QR ticket and sends a confirmation email to the participant.
          </p>
          {pendingPaymentProofs.length === 0 ? (
            <div className="empty-state"><p>No pending payment proofs to review</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingPaymentProofs.map(reg => (
                <div key={reg._id || reg.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <a
                    href={`${BACKEND_URL}${reg.paymentScreenshot}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block', flexShrink: 0 }}
                  >
                    <img
                      src={`${BACKEND_URL}${reg.paymentScreenshot}`}
                      alt="Payment proof"
                      style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#6366f1' }}>View full ↗</span>
                  </a>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{reg.participantName}</div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{reg.email}</div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      Event: <strong>{reg.event?.title || 'Merchandise'}</strong>
                    </div>
                    {reg.merchandise && (
                      <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        {reg.merchandise.size && `Size: ${reg.merchandise.size}`}
                        {reg.merchandise.color && ` • Color: ${reg.merchandise.color}`}
                        {` • Qty: ${reg.merchandise.quantity || 1}`}
                      </div>
                    )}
                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
                      ₹{reg.paymentAmount || 0}
                    </div>
                    <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '6px', padding: '2px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
                      🕐 Awaiting Approval
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '140px' }}>
                    <button
                      onClick={() => handleApprovePayment(reg._id || reg.id)}
                      disabled={processingPaymentId === (reg._id || reg.id)}
                      style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1rem', fontWeight: 600, cursor: 'pointer', opacity: processingPaymentId === (reg._id || reg.id) ? 0.6 : 1 }}
                    >
                      ✓ Approve Payment
                    </button>
                    <button
                      onClick={() => handleRejectPayment(reg._id || reg.id)}
                      disabled={processingPaymentId === (reg._id || reg.id)}
                      style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1rem', fontWeight: 600, cursor: 'pointer', opacity: processingPaymentId === (reg._id || reg.id) ? 0.6 : 1 }}
                    >
                      ✕ Reject Payment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RegistrationManagement;
