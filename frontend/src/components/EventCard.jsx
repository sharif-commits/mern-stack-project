import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateShort, getEventAvailability, formatTime, getOrganizerName } from '../utils/helpers';
import { EVENT_TYPES, USER_ROLES } from '../utils/constants';
import './EventCard.css';

function EventCard({ event, onDelete, isRegistered = false }) {
  const { user } = useAuth();

  const availabilityStatus = getEventAvailability(event);
  const capacity = event.capacity || event.maxParticipants || 0;
  const registered = event.registered || 0;
  const isFull = capacity > 0 && registered >= capacity;
  const isParticipant = user?.role === USER_ROLES.PARTICIPANT;
  const canManage = user?.role === USER_ROLES.ORGANIZER || user?.role === USER_ROLES.ADMIN;
  const organizerDisplayName = getOrganizerName(event.organizer, event.organizerName);

  return (
    <div className="event-card">
      <div className="event-card-header">
        <span className={`category-badge ${event.category ? event.category.toLowerCase().replace(/\s/g, '-') : 'default'}`}>
          {event.category || 'Uncategorized'}
        </span>
        <div className="badges">
          {event.type === EVENT_TYPES.MERCHANDISE && (
            <span className="type-badge merchandise">Merchandise</span>
          )}
          <span className={`availability-badge ${availabilityStatus.class}`}>
            {availabilityStatus.available} spots left
          </span>
        </div>
      </div>

      <div className="event-card-body">
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="event-cover"
            loading="lazy"
          />
        )}

        <h3 className="event-title">
          <Link to={`/event/${event._id || event.id}`}>{event.title}</Link>
        </h3>
        
        <div className="event-meta">
          <div className="meta-item">
            <span className="icon">Date</span>
            <span>{formatDateShort(event.date)}</span>
          </div>
          <div className="meta-item">
            <span className="icon">Time</span>
            <span>{formatTime(event.time)}</span>
          </div>
          <div className="meta-item">
            <span className="icon">Location</span>
            <span>{event.location}</span>
          </div>
        </div>

        <p className="event-description">
          {(event.description || '').length > 120
            ? `${event.description.substring(0, 120)}...`
            : (event.description || 'No description available.')}
        </p>

        <div className="event-organizer">
          <span className="icon">Organizer</span>
          <span>{organizerDisplayName}</span>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className={`progress-fill ${availabilityStatus.class}`}
              style={{ width: `${capacity > 0 ? (registered / capacity) * 100 : 0}%` }}
            ></div>
          </div>
          <span className="progress-text">
            {registered} / {capacity} registered
          </span>
        </div>
      </div>

      <div className="event-card-footer">
        {isParticipant && (
          <Link
            to={`/event/${event._id || event.id}`}
            className="btn btn-primary"
          >
            View Details
          </Link>
        )}
        {canManage && (
          <div className="action-buttons">
            <Link to={`/organizer/events/edit/${event._id || event.id}`} className="btn btn-secondary">
              Edit
            </Link>
            <button 
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this event?')) {
                  onDelete(event._id || event.id);
                }
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventCard;
