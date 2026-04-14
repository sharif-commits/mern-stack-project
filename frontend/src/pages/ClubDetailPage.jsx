import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { clubsAPI } from '../utils/api';
import { formatDateShort, formatTime } from '../utils/helpers';
import './ClubDetailPage.css';

function ClubDetailPage() {
  const { id } = useParams();
  const { events } = useData();
  const { user, updateProfile } = useAuth();
  const { showSuccess, showError } = useToast();

  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);

  const followedClubs = (user?.preferences?.followedClubs || []).map(clubItem => clubItem._id || clubItem);
  const isFollowing = followedClubs.includes(club?._id);

  useEffect(() => {
    const fetchClub = async () => {
      try {
        setLoading(true);
        const response = await clubsAPI.getById(id);
        if (response.success) {
          setClub(response.data || null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchClub();
  }, [id]);

  const organizerEvents = useMemo(() => {
    if (!club?._id) return [];
    return events.filter((eventItem) => {
      const eventClubId = eventItem.clubId?._id || eventItem.clubId;
      return String(eventClubId) === String(club._id);
    });
  }, [events, club]);

  const upcomingEvents = organizerEvents.filter(e => new Date(e.date) >= new Date());
  const pastEvents = organizerEvents.filter(e => new Date(e.date) < new Date());

  if (loading) {
    return (
      <div className="club-detail-page">
        <div className="not-found">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!club && !loading) {
    return (
      <div className="club-detail-page">
        <div className="not-found">
          <h2>Club Not Found</h2>
          <p>Sorry, we couldn't find the club you're looking for.</p>
          <Link to="/clubs" className="btn btn-primary">Back to Clubs</Link>
        </div>
      </div>
    );
  }

  const handleFollowToggle = async () => {
    if (!user) return;

    const updatedClubs = isFollowing
      ? followedClubs.filter(clubId => clubId !== club._id)
      : [...followedClubs, club._id];

    const result = await updateProfile({ followedClubs: updatedClubs });
    if (result.success) {
      const refreshedClub = await clubsAPI.getById(id);
      if (refreshedClub.success) {
        setClub(refreshedClub.data || null);
      }
      showSuccess(isFollowing ? 'Unfollowed club' : 'Following club');
    } else {
      showError(result.error || 'Failed to update followed clubs');
    }
  };

  return (
    <div className="club-detail-page">
      <div className="club-detail-header">
        <div className="club-header-content">
          <div className="club-avatar-large">
            {club.name.charAt(0).toUpperCase()}
          </div>
          <div className="club-info">
            <div className="club-category-badge">{club.category}</div>
            <h1>{club.name}</h1>
            <p className="club-description">{club.description}</p>
            <div className="club-meta">
              <div className="meta-item">
                <span className="meta-icon">👥</span>
                <span>{club.members?.length || 0} followers</span>
              </div>
              <div className="meta-item">
                <span className="meta-icon">📅</span>
                <span>{organizerEvents.length} total events</span>
              </div>
              <div className="meta-item">
                <span className="meta-icon">📧</span>
                <span>{club.contact?.email || '-'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="club-actions">
          <button
            className={`btn btn-large ${isFollowing ? 'btn-following' : 'btn-primary'}`}
            onClick={handleFollowToggle}
          >
            {isFollowing ? '✓ Following' : '+ Follow Club'}
          </button>
        </div>
      </div>

      <div className="club-detail-content">
        <div className="events-section">
          <h2>Upcoming Events ({upcomingEvents.length})</h2>
          {upcomingEvents.length === 0 ? (
            <div className="empty-message">
              <p>No upcoming events scheduled</p>
            </div>
          ) : (
            <div className="events-list">
              {upcomingEvents.map(event => (
                <Link key={event._id || event.id} to={`/event/${event._id || event.id}`} className="event-item">
                  <div className="event-date">
                    <div className="date-day">{new Date(event.date).getDate()}</div>
                    <div className="date-month">
                      {formatDateShort(event.date)}
                    </div>
                  </div>
                  <div className="event-info">
                    <h3>{event.title}</h3>
                    <div className="event-meta-row">
                      <span>⏰ {formatTime(event.time)}</span>
                      <span>📍 {event.location}</span>
                      <span>👥 {event.registered || 0}/{event.capacity || event.maxParticipants || 0}</span>
                    </div>
                  </div>
                  <div className="event-arrow">→</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="events-section">
          <h2>Past Events ({pastEvents.length})</h2>
          {pastEvents.length === 0 ? (
            <div className="empty-message">
              <p>No past events</p>
            </div>
          ) : (
            <div className="events-list">
              {pastEvents.slice(0, 10).map(event => (
                <Link key={event._id || event.id} to={`/event/${event._id || event.id}`} className="event-item past">
                  <div className="event-date">
                    <div className="date-day">{new Date(event.date).getDate()}</div>
                    <div className="date-month">
                      {formatDateShort(event.date)}
                    </div>
                  </div>
                  <div className="event-info">
                    <h3>{event.title}</h3>
                    <div className="event-meta-row">
                      <span>📅 {formatDateShort(event.date)}</span>
                      <span>👥 {event.registered || 0} attended</span>
                    </div>
                  </div>
                  <div className="event-arrow">→</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="back-link">
        <Link to="/clubs" className="btn btn-outline">← Back to All Clubs</Link>
      </div>
    </div>
  );
}

export default ClubDetailPage;
