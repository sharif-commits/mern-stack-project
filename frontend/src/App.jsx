import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import EventList from './components/EventList';
import EventDetails from './components/EventDetails';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './components/Login.jsx';
import ParticipantRegister from './components/ParticipantRegister.jsx';
import ParticipantDashboard from './pages/ParticipantDashboard.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import TicketPage from './pages/TicketPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import ClubsPage from './pages/ClubsPage.jsx';
import ClubDetailPage from './pages/ClubDetailPage.jsx';
import TeamManagement from './pages/TeamManagement.jsx';
import OrganizerDashboard from './pages/OrganizerDashboard.jsx';
import EventFormBuilder from './pages/EventFormBuilder.jsx';
import ManageEventsPage from './pages/ManageEventsPage.jsx';
import RegistrationManagement from './pages/RegistrationManagement.jsx';
import PaymentApproval from './pages/PaymentApproval.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ClubManagement from './pages/ClubManagement.jsx';
import UserManagement from './pages/UserManagement.jsx';
import QRScanner from './components/QRScanner.jsx';
import DiscussionForum from './components/DiscussionForum.jsx';
import FeedbackSystem from './components/FeedbackSystem.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useData } from './context/DataContext.jsx';
import { useToast } from './components/Toast.jsx';
import { USER_ROLES } from './utils/constants';

function AppContent() {
  const { user, logout } = useAuth();
  const { events, registerForEvent, deleteEvent, updateEvent, addEvent } = useData();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleRegister = async (eventId) => {
    if (!user) {
      showError('Please login to register');
      return;
    }

    const result = await registerForEvent(user.id, eventId);
    if (result?.success) {
      showSuccess('Successfully registered for event!');
    } else {
      showError(result?.message || 'Registration failed');
    }
  };

  const handleDelete = (id) => {
    if (!user || (user.role !== USER_ROLES.ORGANIZER && user.role !== USER_ROLES.ADMIN)) {
      showError('You do not have permission to delete events');
      return;
    }
    deleteEvent(id);
    showSuccess('Event deleted successfully');
  };

  const handleAddEvent = (newEvent) => {
    addEvent(newEvent);
    showSuccess('Event created successfully');
  };

  const handleUpdateEvent = (id, updatedEvent) => {
    updateEvent(id, updatedEvent);
    showSuccess('Event updated successfully');
  };

  return (
    <div className="app">
      <header className="app-header">
          <div className="container">
            <h1 className="logo">
              <Link to="/">Felicity</Link>
            </h1>
            <nav className="nav">
              {user && (
                <>
                  {user.role === USER_ROLES.PARTICIPANT && (
                    <>
                      <Link to="/dashboard" className="nav-link">Dashboard</Link>
                      <Link to="/events" className="nav-link">Browse Events</Link>
                      <Link to="/clubs" className="nav-link">Clubs/Organizers</Link>
                      <Link to="/dashboard/teams" className="nav-link">Teams</Link>
                      <Link to="/profile" className="nav-link">Profile</Link>
                    </>
                  )}
                  {user.role === USER_ROLES.ORGANIZER && (
                    <>
                      <Link to="/organizer/dashboard" className="nav-link">Dashboard</Link>
                      <Link to="/organizer/events" className="nav-link">Ongoing Events</Link>
                      <Link to="/organizer/events/create" className="nav-link">Create Event</Link>
                      <Link to="/profile" className="nav-link">Profile</Link>
                      <Link to="/organizer/registrations" className="nav-link">Registrations</Link>
                      <Link to="/organizer/payments" className="nav-link">Payments</Link>
                    </>
                  )}
                  {user.role === USER_ROLES.ADMIN && (
                    <>
                      <Link to="/admin/dashboard" className="nav-link">Dashboard</Link>
                      <Link to="/admin/clubs" className="nav-link">Manage Clubs/Organizers</Link>
                      <Link to="/admin/users" className="nav-link">Password Reset Requests</Link>
                    </>
                  )}
                </>
              )}
              {!user && (
                <>
                  <Link to="/login" className="nav-link">Login</Link>
                  <Link to="/register" className="nav-link">Register</Link>
                </>
              )}
            </nav>

            {user && (
              <div className="user-badge">
                <span className="role-chip">{user.role}</span>
                <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </header>

        <main className="main-content">
          <div className="container">
            <Routes>
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.PARTICIPANT]}>
                    <ParticipantDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.PARTICIPANT]}>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/events" 
                element={
                  <ProtectedRoute>
                    <EventList 
                      events={events} 
                      onDelete={handleDelete}
                      onRegister={handleRegister}
                    />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <EventList 
                      events={events} 
                      onDelete={handleDelete}
                      onRegister={handleRegister}
                    />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/create" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER, USER_ROLES.ADMIN]}>
                    <EventFormBuilder />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/edit/:id" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER, USER_ROLES.ADMIN]}>
                    <EventFormBuilder />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/event/:id" 
                element={
                  <ProtectedRoute>
                    <EventDetails 
                      onRegister={handleRegister}
                      onDelete={handleDelete}
                    />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.PARTICIPANT, USER_ROLES.ORGANIZER]}>
                    <ProfilePage />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/ticket/:id"
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.PARTICIPANT, USER_ROLES.ORGANIZER, USER_ROLES.ADMIN]}>
                    <TicketPage />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/clubs" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.PARTICIPANT]}>
                    <ClubsPage />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/dashboard/teams"
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.PARTICIPANT]}>
                    <TeamManagement />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/club/:id" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.PARTICIPANT]}>
                    <ClubDetailPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/organizer/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER]}>
                    <OrganizerDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/organizer/events" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER]}>
                    <ManageEventsPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/organizer/events/create" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER]}>
                    <EventFormBuilder />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/organizer/events/edit/:id" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER]}>
                    <EventFormBuilder />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/organizer/events/:eventId/manage" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER]}>
                    <RegistrationManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/organizer/registrations" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER]}>
                    <RegistrationManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/organizer/payments" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER]}>
                    <PaymentApproval />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/organizer/checkin/:eventId" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ORGANIZER, USER_ROLES.ADMIN]}>
                    <QRScanner />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/forum/:eventId" 
                element={
                  <ProtectedRoute>
                    <DiscussionForum />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/feedback/:eventId" 
                element={
                  <ProtectedRoute>
                    <FeedbackSystem />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin" 
                element={<Navigate to="/admin/dashboard" replace />}
              />
              <Route 
                path="/admin/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ADMIN]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/clubs" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ADMIN]}>
                    <ClubManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/users" 
                element={
                  <ProtectedRoute allowedRoles={[USER_ROLES.ADMIN]}>
                    <UserManagement />
                  </ProtectedRoute>
                } 
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<ParticipantRegister />} />
            </Routes>
          </div>
        </main>

      </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

