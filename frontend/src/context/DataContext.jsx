import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { eventsAPI, registrationsAPI } from '../utils/api';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  // Initialize events from API instead of localStorage
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch events from backend on mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await eventsAPI.getAllEvents();
        if (response.success) {
          const normalized = (response.data || []).map(evt => ({
            ...evt,
            id: evt._id || evt.id
          }));
          setEvents(normalized);
        }
      } catch (err) {
        console.error('Error fetching events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Event Management - Now using API
  const addEvent = async (eventData) => {
    try {
      const response = await eventsAPI.createEvent(eventData);
      if (response.success) {
        const newEvent = {
          ...response.data,
          id: response.data._id || response.data.id
        };
        setEvents(prev => [...prev, newEvent]);
        return newEvent._id || newEvent.id;
      }
    } catch (err) {
      console.error('Error creating event:', err);
    }
    return null;
  };

  const updateEvent = async (id, updates) => {
    try {
      const response = await eventsAPI.updateEvent(id, updates);
      if (response.success) {
        setEvents(prev =>
          prev.map(event => 
            (event._id === id || event.id === id) 
              ? { ...event, ...response.data, id: response.data._id || response.data.id || event.id } 
              : event
          )
        );
        return response.data;
      }
      throw new Error(response?.message || 'Failed to update event');
    } catch (err) {
      console.error('Error updating event:', err);
      throw err;
    }
  };

  const deleteEvent = async (id) => {
    try {
      const response = await eventsAPI.deleteEvent(id);
      if (response.success) {
        setEvents(prev => prev.filter(event => event._id !== id && event.id !== id));
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const getEventById = (id) => {
    return events.find(event => 
      event._id === id || event.id === id || 
      event._id === parseInt(id) || event.id === parseInt(id)
    );
  };

  // Registration Management - Now using API
  const registerForEvent = async (userId, eventId, formData = {}) => {
    try {
      const response = await registrationsAPI.registerForEvent(eventId, formData);
      if (response.success) {
        const registration = response.data;
        
        // Update event registered count locally
        setEvents(prev => prev.map(event => {
          if (event._id === eventId || event.id === eventId) {
            return { ...event, registered: (event.registered || 0) + 1 };
          }
          return event;
        }));
        
        return { success: true, registration };
      } else {
        return { success: false, message: response.message };
      }
    } catch (err) {
      console.error('Error registering for event:', err);
      return { success: false, message: 'Failed to register for event' };
    }
  };

  const value = useMemo(
    () => ({
      events,
      loading,
      addEvent,
      updateEvent,
      deleteEvent,
      getEventById,
      registerForEvent,
    }),
    [events, loading]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}
