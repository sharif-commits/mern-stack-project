import { useState, useMemo, useEffect } from 'react';
import EventCard from './EventCard';
import { searchEvents, filterEvents, sortEvents } from '../utils/helpers';
import { EVENT_TYPES, EVENT_CATEGORIES } from '../utils/constants';
import { eventsAPI, registrationsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext.jsx';
import './EventList.css';

function EventList({ events: propEvents, onDelete }) {
  const { user } = useAuth();
  const [events, setEvents] = useState(propEvents || []);
  const [loading, setLoading] = useState(!propEvents);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterEligibility, setFilterEligibility] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [followedOnly, setFollowedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [trendingEvents, setTrendingEvents] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await eventsAPI.getAllEvents();
        if (response.success) {
          setEvents(response.data || []);
        } else {
          setError(response.message || 'Failed to fetch events');
        }
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Failed to load events. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (!propEvents) {
      fetchEvents();
    }
  }, [propEvents]);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await eventsAPI.getAllEvents({ trending: 'true' });
        if (response.success) {
          setTrendingEvents(response.data || []);
        }
      } catch (err) {
        console.error('Error fetching trending events:', err);
      }
    };

    fetchTrending();
  }, []);

  useEffect(() => {
    const fetchMyRegistrations = async () => {
      if (!user || user.role !== 'Participant') {
        setMyRegistrations([]);
        return;
      }

      try {
        const response = await registrationsAPI.getUserRegistrations();
        if (response.success) {
          setMyRegistrations(response.data || []);
        }
      } catch (err) {
        console.error('Error fetching participant registrations:', err);
      }
    };

    fetchMyRegistrations();
  }, [user]);

  const registeredEventIds = useMemo(() => {
    return new Set(
      (myRegistrations || [])
        .filter(registration => {
          const status = (registration.status || '').toLowerCase();
          return status !== 'rejected' && status !== 'cancelled';
        })
        .map(registration => (registration.event?._id || registration.eventId || registration.event || '').toString())
        .filter(Boolean)
    );
  }, [myRegistrations]);

  const filteredEvents = useMemo(() => {
    let result = searchEvents(events, searchTerm);
    result = filterEvents(result, {
      type: filterType !== 'All' ? filterType : null,
      category: filterCategory !== 'All' ? filterCategory : null,
      eligibility: filterEligibility !== 'All' ? filterEligibility : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      followedOnly,
      followedClubs: (user?.preferences?.followedClubs || []).map(c => c._id || c)
    });
    // When sortBy is 'date', keep API order so preference-based ordering from backend is preserved
    if (sortBy !== 'date') {
      result = sortEvents(result, sortBy);
    }
    return result;
  }, [events, searchTerm, filterType, filterCategory, filterEligibility, dateFrom, dateTo, followedOnly, sortBy, user]);

  const hasPreferences = Boolean(
    user &&
    ((user.preferences?.interests?.length || 0) > 0 || (user.preferences?.followedClubs?.length || 0) > 0)
  );
  const usePreferenceOrder = sortBy === 'date' && hasPreferences;
  const recommendedEvents = usePreferenceOrder ? filteredEvents.slice(0, 6) : [];
  const remainingEvents = usePreferenceOrder && filteredEvents.length > 6 ? filteredEvents.slice(6) : filteredEvents;

  return (
    <div className="event-list-container">
      <div className="event-list-header">
        <h2>Upcoming Events</h2>
        <p className="subtitle">Discover and join amazing events near you</p>
      </div>

      {trendingEvents.length > 0 && (
        <div className="trending-section">
          <h3>Trending Now</h3>
          <div className="events-grid">
            {trendingEvents.map(event => (
              <EventCard
                key={event._id || event.id}
                event={event}
                onDelete={onDelete}
                isRegistered={registeredEventIds.has((event._id || event.id || '').toString())}
              />
            ))}
          </div>
        </div>
      )}

      {recommendedEvents.length > 0 && (
        <div className="recommended-section trending-section">
          <h3>Recommended for you</h3>
          <p className="section-subtitle">Based on your interests and followed clubs</p>
          <div className="events-grid">
            {recommendedEvents.map(event => (
              <EventCard
                key={event._id || event.id}
                event={event}
                onDelete={onDelete}
                isRegistered={registeredEventIds.has((event._id || event.id || '').toString())}
              />
            ))}
          </div>
        </div>
      )}

      <div className="controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="All">All Types</option>
            {Object.values(EVENT_TYPES).map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            <option value="All">All Categories</option>
            {EVENT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="date">Sort by Date</option>
            <option value="title">Sort by Title</option>
            <option value="capacity">Sort by Capacity</option>
          </select>
        </div>
        <div className="filters">
          <select
            value={filterEligibility}
            onChange={(e) => setFilterEligibility(e.target.value)}
            className="filter-select"
          >
            <option value="All">All Eligibility</option>
            <option value="IIIT">IIIT Only</option>
            <option value="Non-IIIT">External Only</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="filter-select"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="filter-select"
          />
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={followedOnly}
              onChange={(e) => setFollowedOnly(e.target.checked)}
            />
            Followed Clubs
          </label>
        </div>
      </div>

      {loading ? (
        <div className="loading-message">
          <p>Loading events...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="no-events">
          <p>No events found. Try adjusting your search or filters.</p>
        </div>
      ) : (usePreferenceOrder ? remainingEvents : filteredEvents).length > 0 ? (
        <div className="events-grid">
          {(usePreferenceOrder ? remainingEvents : filteredEvents).map(event => (
            <EventCard
              key={event._id || event.id}
              event={event}
              onDelete={onDelete}
              isRegistered={registeredEventIds.has((event._id || event.id || '').toString())}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default EventList;
