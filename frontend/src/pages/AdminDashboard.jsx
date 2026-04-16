import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI, eventsAPI } from '../utils/api';
import { formatDate } from '../utils/helpers';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [timeRange, setTimeRange] = useState('week'); // week, month, all
  const [systemStats, setSystemStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await adminAPI.getStats();
        if (response.success) {
          setSystemStats(response.data);
        }
        const eventsResponse = await eventsAPI.getAll();
        if (eventsResponse.success) {
          setEvents(eventsResponse.data || []);
        }
      } catch (err) {
        console.error('Error fetching system stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const filterByDate = (items, dateField) => {
      return {
        week: items.filter(item => new Date(item[dateField]) >= weekAgo).length,
        month: items.filter(item => new Date(item[dateField]) >= monthAgo).length,
        all: items.length
      };
    };

    const totalUsers = systemStats?.users?.total ?? 0;
    const participants = systemStats?.users?.byRole?.find(r => r._id === 'Participant')?.count ?? 0;
    const organizersCount = systemStats?.users?.byRole?.find(r => r._id === 'Organizer')?.count ?? 0;

    const totalEvents = systemStats?.events?.total ?? events.length;
    const upcomingEvents = systemStats?.events?.upcoming ?? events.filter(e => new Date(e.date) > now).length;
    const pastEvents = Math.max(0, totalEvents - upcomingEvents);

    const newEvents = filterByDate(events.filter(e => e.createdAt), 'createdAt');
    const newRegistrations = {
      week: systemStats?.registrations?.byStatus ? 0 : 0,
      month: systemStats?.registrations?.byStatus ? 0 : 0,
      all: systemStats?.registrations?.total ?? 0
    };

    const pendingApprovals = systemStats?.registrations?.byStatus?.find(s => s._id === 'pending')?.count ?? 0;

    const totalRevenue = (systemStats?.payments ?? []).reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalRegistrations = systemStats?.registrations?.total ?? 0;

    return {
      totalUsers,
      participants,
      organizersCount,
      totalEvents,
      upcomingEvents,
      pastEvents,
      newEvents,
      newRegistrations,
      pendingApprovals,
      totalRevenue,
      totalRegistrations
    };
  }, [events, systemStats]);

  // Recent activities
  const recentActivities = useMemo(() => {
    if (systemStats?.recentActivity) {
      const activities = [];
      const recentEvents = systemStats.recentActivity.events || [];
      const recentUsers = systemStats.recentActivity.users || [];

      recentEvents.forEach(event => {
        activities.push({
          type: 'event',
          message: `New event created: ${event.title}`,
          date: event.createdAt || event.date,
          organizer: event.organizer ? `${event.organizer.firstName || ''} ${event.organizer.lastName || ''}`.trim() : undefined,
          status: event.status
        });
      });

      recentUsers.forEach(user => {
        activities.push({
          type: 'user',
          message: `New user: ${(user.firstName || '').trim()} ${(user.lastName || '').trim()} (${user.role})`,
          date: user.createdAt,
          status: user.role
        });
      });

      return activities
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);
    }

    return [];
  }, [systemStats]);

  // Popular events
  const popularEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => (b.registered || 0) - (a.registered || 0))
      .slice(0, 5);
  }, [events]);

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="time-range-selector">
          <button
            className={timeRange === 'week' ? 'active' : ''}
            onClick={() => setTimeRange('week')}
          >
            This Week
          </button>
          <button
            className={timeRange === 'month' ? 'active' : ''}
            onClick={() => setTimeRange('month')}
          >
            This Month
          </button>
          <button
            className={timeRange === 'all' ? 'active' : ''}
            onClick={() => setTimeRange('all')}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Main Statistics Grid */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.totalUsers}</h3>
            <p>Total Users</p>
            <span className="stat-detail">
              {stats.participants} participants • {stats.organizersCount} organizers
            </span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>{stats.totalEvents}</h3>
            <p>Total Events</p>
            <span className="stat-detail">
              {stats.upcomingEvents} upcoming • {stats.pastEvents} past
            </span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>{stats.totalRegistrations}</h3>
            <p>Total Registrations</p>
            <span className="stat-detail">
              {stats.pendingApprovals} pending approval
            </span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>₹{stats.totalRevenue.toLocaleString()}</h3>
            <p>Total Revenue</p>
            <span className="stat-detail">From approved registrations</span>
          </div>
        </div>
      </div>

      {/* Activity Statistics */}
      <div className="activity-stats">
        <div className="activity-card">
          <h3>New Events</h3>
          <div className="activity-numbers">
            <div className="activity-number">
              <span className="number">{stats.newEvents[timeRange]}</span>
              <span className="label">
                {timeRange === 'week' ? 'This Week' : timeRange === 'month' ? 'This Month' : 'All Time'}
              </span>
            </div>
          </div>
        </div>

        <div className="activity-card">
          <h3>New Registrations</h3>
          <div className="activity-numbers">
            <div className="activity-number">
              <span className="number">{stats.newRegistrations[timeRange]}</span>
              <span className="label">
                {timeRange === 'week' ? 'This Week' : timeRange === 'month' ? 'This Month' : 'All Time'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Recent Activities */}
        <div className="section">
          <div className="section-header">
            <h2>Recent Activities</h2>
          </div>
          <div className="activities-list">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className={`activity-icon ${activity.type}`}>
                    {activity.type === 'event' ? '📅' : activity.type === 'user' ? '👤' : '📝'}
                  </div>
                  <div className="activity-content">
                    <p>{activity.message}</p>
                    <span className="activity-meta">
                      {formatDate(activity.date)}
                      {activity.organizer && ` • ${activity.organizer}`}
                      {activity.status && (
                        <span className={`status-badge ${activity.status}`}>
                          {activity.status}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-message">No recent activities</p>
            )}
          </div>
        </div>

        {/* Popular Events */}
        <div className="section">
          <div className="section-header">
            <h2>Popular Events</h2>
            <Link to="/admin/events">View All →</Link>
          </div>
          <div className="popular-events">
            {popularEvents.map(event => (
              <div key={event._id || event.id} className="popular-event-card">
                <h4>{event.title}</h4>
                <div className="event-stats">
                  <span>{event.registered || event.registrationCount || event.registrations?.length || 0} / {event.capacity || event.maxParticipants || event.participantLimit || 0} registered</span>
                  <span className="event-date">{formatDate(event.date)}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${((event.registered || event.registrationCount || event.registrations?.length || 0) / (event.capacity || event.maxParticipants || event.participantLimit || 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <Link to="/admin/users" className="action-card">
            <span className="action-icon">👥</span>
            <h3>Manage Users</h3>
            <p>View and manage all users</p>
          </Link>
          <Link to="/admin/clubs" className="action-card">
            <span className="action-icon">🏢</span>
            <h3>Manage Clubs</h3>
            <p>Approve and manage organizers</p>
          </Link>
          <Link to="/admin/events" className="action-card">
            <span className="action-icon">📅</span>
            <h3>Event Approval</h3>
            <p>Review pending events</p>
          </Link>
          <Link to="/admin/reports" className="action-card">
            <span className="action-icon">📊</span>
            <h3>View Reports</h3>
            <p>Analytics and insights</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
