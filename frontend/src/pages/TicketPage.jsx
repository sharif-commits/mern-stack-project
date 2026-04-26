import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { registrationsAPI } from '../utils/api';
import { formatDate, formatTime } from '../utils/helpers';
import './TicketPage.css';

const TicketPage = () => {
  const { id } = useParams();
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await registrationsAPI.getById(id);
        if (res.success) {
          setRegistration(res.data);
        } else {
          setError(res.message || 'Ticket not found');
        }
      } catch (err) {
        setError(err.message || 'Failed to load ticket');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return <div className="ticket-page"><p>Loading ticket...</p></div>;
  }

  if (!registration || error) {
    return (
      <div className="ticket-page">
        <p>{error || 'Ticket not found'}</p>
        <Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
      </div>
    );
  }

  const event = registration.event || {};

  return (
    <div className="ticket-page">
      <div className="ticket-card">
        <div className="ticket-header">
          <h1>Event Ticket</h1>
          <p className="ticket-id">Ticket ID: {registration.ticketId}</p>
        </div>

        <div className="ticket-body">
          <div className="ticket-info">
            <h2>{event.title || 'Event'}</h2>
            <p>{event.venue || event.location || 'Venue TBD'}</p>
            {event.date && (
              <p>
                {formatDate(event.date)} • {event.time ? formatTime(event.time) : ''}
              </p>
            )}
            {registration.isTeam && registration.teamName && (
              <p>Team: {registration.teamName}</p>
            )}
            <p>Status: {registration.status}</p>
          </div>
          {registration.ticketQr && (
            <div className="ticket-qr">
              <img src={registration.ticketQr} alt="Ticket QR" />
              <p>Show this QR at check-in</p>
            </div>
          )}
        </div>

        <div className="ticket-footer">
          <Link to={`/event/${event._id || event.id || ''}`} className="btn btn-outline">Event Details</Link>
          <Link to="/dashboard" className="btn btn-secondary">My Dashboard</Link>
        </div>
      </div>
    </div>
  );
};

export default TicketPage;
