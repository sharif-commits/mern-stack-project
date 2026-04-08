import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toast.jsx';
import { isIIITEmail } from '../utils/helpers';
import './ParticipantRegister.css';

function ParticipantRegister() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [participantType, setParticipantType] = useState('IIIT');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [college, setCollege] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');

  const validate = () => {
    if (!firstName.trim()) return 'First name is required';
    if (!lastName.trim()) return 'Last name is required';
    if (!email.trim()) return 'Email is required';
    if (participantType === 'IIIT' && !isIIITEmail(email)) {
      return 'IIIT participants must use their IIIT email (@iiit.ac.in, @students.iiit.ac.in or @research.iiit.ac.in)';
    }
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (participantType !== 'IIIT' && !college.trim()) return 'College / Organization is required';
    if (!contact.trim()) return 'Contact number is required';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    // Call backend registration API
    const userData = {
      firstName,
      lastName,
      email,
      password,
      participantType,
      college: participantType === 'IIIT' ? 'IIIT Hyderabad' : college,
      contactNumber: contact
    };

    const result = await register(userData);
    
    if (result.success) {
      showSuccess('Registration successful! Welcome to the Event Management System.');
      navigate('/onboarding', { replace: true });
    } else {
      setError(result.error || 'Registration failed');
      showError(result.error || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="auth-page">
      <div className="container auth-container">
        <div className="auth-card">
          <h1>Create Participant Account</h1>
          <p className="muted">Only participants can self-register. IIIT users must use institute email.</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Participant Type</label>
              <div className="role-options">
                {['IIIT', 'Non-IIIT'].map((option) => (
                  <label key={option} className={`pill ${participantType === option ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="participantType"
                      value={option}
                      checked={participantType === option}
                      onChange={() => setParticipantType(option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
              {participantType === 'IIIT' && (
                <p className="hint">
                  Use your IIIT email to complete registration
                  (@iiit.ac.in, @students.iiit.ac.in or @research.iiit.ac.in).
                </p>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                />
              </div>
            </div>

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
                placeholder="At least 6 characters"
                required
              />
            </div>

            {participantType === 'IIIT' ? (
              <div className="form-group">
                <label>College / Organization</label>
                <input
                  type="text"
                  value={college || 'IIIT Hyderabad'}
                  readOnly
                  disabled
                />
                <p className="hint">IIIT participants are auto-tagged as IIIT Hyderabad.</p>
              </div>
            ) : (
              <div className="form-group">
                <label>College / Organization</label>
                <input
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="Your college or organization"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Contact Number</label>
              <input
                type="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone number"
                required
              />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button type="submit" className="btn btn-primary full-width">Create Account</button>
          </form>
          <div className="auth-footer">
            <p>Already have an account? <a href="/login" className="link">Login here</a></p>
          </div>
          <div className="auth-notes">
            <p><strong>Who can register?</strong> Only Participants. Organizers are provisioned by Admin. Admin account is backend-only.</p>
            <p>This is a frontend-only flow; in production, connect to backend signup API with bcrypt+JWT per requirements.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParticipantRegister;
