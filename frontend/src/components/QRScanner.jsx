import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toast.jsx';
import { eventsAPI, registrationsAPI } from '../utils/api';
import './QRScanner.css';

function QRScanner() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [manualTicketId, setManualTicketId] = useState('');
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanHistory, setScanHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, checkedIn: 0, pending: 0 });
  const [searchTerm, setSearchTerm] = useState('');

  const eventRegistrations = registrations;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const eventRes = await eventsAPI.getEventById(eventId);
        if (eventRes.success) {
          setEvent(eventRes.data);
        }
        const regRes = await registrationsAPI.getEventRegistrations(eventId);
        if (regRes.success) {
          setRegistrations(regRes.data || []);
        }
      } catch (err) {
        showError('Failed to load event check-ins');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [eventId, showError]);

  useEffect(() => {
    if (eventRegistrations.length > 0) {
      const total = eventRegistrations.length;
      const checkedIn = eventRegistrations.filter(r => r.checkedIn).length;
      const pending = total - checkedIn;
      setStats({ total, checkedIn, pending });
    }
  }, [eventRegistrations]);

  if (loading) {
    return (
      <div className="qr-scanner-container">
        <div className="not-found">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="qr-scanner-container">
        <div className="not-found">
          <h2>Event Not Found</h2>
          <button onClick={() => navigate('/organizer/events')} className="btn btn-primary">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  // Check if user is organizer of this event
  const organizerId = event.organizer?._id || event.organizer || event.organizerId;
  const isOrganizer = organizerId?.toString() === user?.id || user?.role === 'Admin';
  if (!isOrganizer) {
    return (
      <div className="qr-scanner-container">
        <div className="not-found">
          <h2>Access Denied</h2>
          <p>You don't have permission to access this page.</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const handleManualCheckIn = async () => {
    const ticketId = manualTicketId.trim().toUpperCase();
    if (!ticketId) {
      showError('Please enter a ticket ID');
      return;
    }

    const registration = eventRegistrations.find(r => 
      r.ticketId === ticketId && r.status === 'confirmed'
    );

    if (!registration) {
      showError('Invalid ticket ID or registration not confirmed');
      setManualTicketId('');
      return;
    }

    if (registration.checkedIn) {
      showInfo(`Already checked in at ${new Date(registration.checkInTime).toLocaleTimeString()}`);
      setManualTicketId('');
      return;
    }

    try {
      const response = await registrationsAPI.checkIn(registration._id || registration.id);
      if (response.success) {
        setRegistrations(prev =>
          prev.map(reg => ((reg._id || reg.id) === (registration._id || registration.id) ? response.data : reg))
        );
      }
    } catch (err) {
      showError('Failed to check in participant');
      return;
    }

    setScanHistory(prev => [{
      ticketId: registration.ticketId,
      participantName: registration.participantName,
      time: new Date().toISOString(),
      status: 'success'
    }, ...prev]);

    showSuccess(`${registration.participantName} checked in successfully!`);
    setManualTicketId('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleManualCheckIn();
    }
  };

  const filteredRegistrations = eventRegistrations.filter(reg => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      reg.participantName?.toLowerCase().includes(search) ||
      reg.email?.toLowerCase().includes(search) ||
      reg.ticketId?.toLowerCase().includes(search)
    );
  });

  const handleBulkCheckIn = async (registration) => {
    if (registration.checkedIn) {
      showInfo('Participant already checked in');
      return;
    }

    if (registration.status !== 'confirmed') {
      showError('Registration must be confirmed before check-in');
      return;
    }

    try {
      const response = await registrationsAPI.checkIn(registration._id || registration.id);
      if (response.success) {
        setRegistrations(prev =>
          prev.map(reg => ((reg._id || reg.id) === (registration._id || registration.id) ? response.data : reg))
        );
      }
    } catch (err) {
      showError('Failed to check in participant');
      return;
    }

    setScanHistory(prev => [{
      ticketId: registration.ticketId,
      participantName: registration.participantName,
      time: new Date().toISOString(),
      status: 'success'
    }, ...prev]);

    showSuccess(`${registration.participantName} checked in!`);
  };

  return (
    <div className="qr-scanner-container">
      <div className="scanner-header">
        <div className="header-content">
          <button onClick={() => navigate('/organizer/events')} className="btn-back">
            Back
          </button>
          <div className="header-info">
            <h1>Check-In Scanner</h1>
            <p className="event-name">{event.title}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="scanner-stats">
        <div className="stat-card">
          <div className="stat-icon">Total</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Registrations</div>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">In</div>
          <div className="stat-content">
            <div className="stat-value">{stats.checkedIn}</div>
            <div className="stat-label">Checked In</div>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon">Pending</div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card percentage">
          <div className="stat-icon">%</div>
          <div className="stat-content">
            <div className="stat-value">
              {stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0}%
            </div>
            <div className="stat-label">Attendance Rate</div>
          </div>
        </div>
      </div>

      {/* Manual Check-In Section */}
      <div className="scanner-section">
        <div className="section-card">
          <h2>Manual Check-In</h2>
          <p className="section-description">
            Enter the ticket ID to check in participants manually
          </p>
          
          <div className="manual-input-group">
            <input
              type="text"
              className="ticket-input"
              placeholder="Enter Ticket ID (e.g., EVT-123456)"
              value={manualTicketId}
              onChange={(e) => setManualTicketId(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
            />
            <button 
              className="btn btn-primary btn-checkin"
              onClick={handleManualCheckIn}
            >
              Check In
            </button>
          </div>

          <div className="scanner-note">
            <span className="note-icon">i</span>
            <span>Tip: Participants can find their Ticket ID in their dashboard</span>
          </div>
        </div>
      </div>

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <div className="scanner-section">
          <div className="section-card">
            <h2>Recent Check-Ins</h2>
            <div className="scan-history">
              {scanHistory.slice(0, 5).map((scan, index) => (
                <div key={index} className={`history-item ${scan.status}`}>
                  <div className="history-icon">
                    {scan.status === 'success' ? 'OK' : 'X'}
                  </div>
                  <div className="history-details">
                    <div className="history-name">{scan.participantName}</div>
                    <div className="history-meta">
                      <span>{scan.ticketId}</span>
                      <span>•</span>
                      <span>{new Date(scan.time).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* All Registrations List */}
      <div className="scanner-section">
        <div className="section-card">
          <div className="section-header">
            <h2>All Registrations</h2>
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, email, or ticket ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="registrations-list">
            {filteredRegistrations.length === 0 ? (
              <div className="empty-state">
                <p>No registrations found</p>
              </div>
            ) : (
              filteredRegistrations.map(reg => (
                <div key={reg._id || reg.id} className={`registration-item ${reg.checkedIn ? 'checked-in' : ''}`}>
                  <div className="reg-info">
                    <div className="reg-icon">
                      {reg.checkedIn ? 'OK' : 'User'}
                    </div>
                    <div className="reg-details">
                      <div className="reg-name">{reg.participantName}</div>
                      <div className="reg-meta">
                        <span>{reg.ticketId}</span>
                        <span>•</span>
                        <span>{reg.email}</span>
                      </div>
                      {reg.checkedIn && reg.checkInTime && (
                        <div className="reg-checkin-time">
                          Checked in at {new Date(reg.checkInTime).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="reg-actions">
                    {reg.status !== 'confirmed' ? (
                      <span className="status-badge pending">{reg.status}</span>
                    ) : reg.checkedIn ? (
                      <span className="status-badge success">Checked In</span>
                    ) : (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleBulkCheckIn(reg)}
                      >
                        Check In
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QRScanner;
