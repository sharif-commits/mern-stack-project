import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toast.jsx';
import { USER_ROLES } from '../utils/constants';
import { isValidEmail } from '../utils/helpers';
import './Login.css';

const ROLE_REDIRECT = {
  [USER_ROLES.PARTICIPANT]: '/dashboard',
  [USER_ROLES.ORGANIZER]: '/organizer/dashboard',
  [USER_ROLES.ADMIN]: '/admin/dashboard',
};

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const validate = () => {
    if (!email.trim() || !password.trim()) {
      return 'Email and password are required';
    }

    if (!isValidEmail(email)) {
      return 'Please enter a valid email address';
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    // Call backend API
    const result = await login({ email, password });

    if (result.success) {
      showSuccess(`Welcome back!`);

      // Redirect based on user role
      const userRole = result.user?.role || USER_ROLES.PARTICIPANT;
      const hasPrefs = (result.user?.preferences?.interests?.length || 0) > 0
        || (result.user?.preferences?.followedClubs?.length || 0) > 0;
      const redirectTo = userRole === USER_ROLES.PARTICIPANT && !hasPrefs
        ? '/onboarding'
        : (location.state?.from || ROLE_REDIRECT[userRole] || '/');
      navigate(redirectTo, { replace: true });
    } else {
      setError(result.error || 'Invalid credentials');
      showError('Login failed. Please check your credentials.');
    }

    // Clear password from state
    setPassword('');
  };

  return (
    <div className="auth-page">
      <div className="container auth-container">
        <div className="auth-card">
          <h1>Sign in</h1>
          <p className="muted">Enter your credentials to continue. Your role is automatically determined by your account.</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button type="submit" className="btn btn-primary full-width">Login</button>
          </form>

          <div className="auth-footer">
            <p>Don't have an account? <Link to="/register" className="link">Register as Participant</Link></p>
          </div>

          <div className="auth-notes">
            <p><strong>Note:</strong></p>
            <p>• Your role (Participant/Organizer/Admin) is determined by your account</p>
            <p>• IIIT participants should use their institute email (@iiit.ac.in, @students.iiit.ac.in or @research.iiit.ac.in)</p>
            <p>• Only participants can self-register. Contact admin for organizer accounts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
