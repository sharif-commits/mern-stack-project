import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { clubsAPI } from '../utils/api';
import { AREAS_OF_INTEREST } from '../utils/constants';
import './OnboardingPage.css';

const OnboardingPage = () => {
  const { user, updateProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [formData, setFormData] = useState({
    interests: [],
    followedClubs: []
  });

  useEffect(() => {
    if (user?.preferences) {
      setFormData({
        interests: user.preferences.interests || [],
        followedClubs: (user.preferences.followedClubs || []).map(c => c._id || c)
      });
    }
  }, [user]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await clubsAPI.getAll();
        if (res.success) setClubs(res.data || []);
      } catch (err) {
        showError('Failed to load clubs');
      }
    };
    load();
  }, [showError]);

  const toggleInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const toggleClub = (clubId) => {
    setFormData(prev => ({
      ...prev,
      followedClubs: prev.followedClubs.includes(clubId)
        ? prev.followedClubs.filter(id => id !== clubId)
        : [...prev.followedClubs, clubId]
    }));
  };

  const handleSave = async () => {
    const result = await updateProfile(formData);
    if (result.success) {
      showSuccess('Preferences saved!');
      navigate('/dashboard');
    } else {
      showError(result.error || 'Failed to save preferences');
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <h1>Welcome! Set Your Preferences</h1>
        <p>Pick interests and clubs to personalize your event feed. You can skip and edit later.</p>

        <section>
          <h2>Areas of Interest</h2>
          <div className="interests-grid">
            {AREAS_OF_INTEREST.map(interest => (
              <label key={interest} className={`interest-chip ${formData.interests.includes(interest) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={formData.interests.includes(interest)}
                  onChange={() => toggleInterest(interest)}
                />
                <span>{interest}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2>Follow Clubs</h2>
          <div className="clubs-grid">
            {clubs.map(club => (
              <label key={club._id} className={`club-card ${formData.followedClubs.includes(club._id) ? 'following' : ''}`}>
                <input
                  type="checkbox"
                  checked={formData.followedClubs.includes(club._id)}
                  onChange={() => toggleClub(club._id)}
                />
                <div>
                  <strong>{club.name}</strong>
                  <div className="club-category">{club.category}</div>
                  <p>{club.description}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        <div className="actions">
          <button className="btn-secondary" onClick={handleSkip}>Skip for now</button>
          <button className="btn-primary" onClick={handleSave}>Save Preferences</button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
