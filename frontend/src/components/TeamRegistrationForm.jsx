import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import './TeamRegistrationForm.css';

const TeamRegistrationForm = ({ event, onSubmit, onCancel }) => {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  
  console.log('TeamRegistrationForm rendered with event:', event);
  
  const [teamData, setTeamData] = useState({
    teamName: '',
    teamLeader: user?.name || `${user?.firstName} ${user?.lastName}` || '',
    teamLeaderEmail: user?.email || '',
    members: [{ name: '', email: '', phone: '' }],
  });
  const [customFieldResponses, setCustomFieldResponses] = useState({});

  const minTeamSize = event.minTeamSize || 2;
  const maxTeamSize = event.maxTeamSize || 5;

  const handleAddMember = () => {
    if (teamData.members.length >= maxTeamSize - 1) {
      showError(`Maximum team size is ${maxTeamSize} (including leader)`);
      return;
    }
    setTeamData({
      ...teamData,
      members: [...teamData.members, { name: '', email: '', phone: '' }],
    });
  };

  const handleRemoveMember = (index) => {
    if (teamData.members.length <= minTeamSize - 1) {
      showError(`Minimum team size is ${minTeamSize} (including leader)`);
      return;
    }
    const newMembers = teamData.members.filter((_, i) => i !== index);
    setTeamData({ ...teamData, members: newMembers });
  };

  const handleMemberChange = (index, field, value) => {
    const newMembers = [...teamData.members];
    newMembers[index][field] = value;
    setTeamData({ ...teamData, members: newMembers });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Team form submitted', teamData);

    // Validation
    if (!teamData.teamName.trim()) {
      showError('Please enter a team name');
      return;
    }

    const totalSize = teamData.members.length + 1; // +1 for leader
    if (totalSize < minTeamSize) {
      showError(`Team must have at least ${minTeamSize} members (including leader)`);
      return;
    }
    if (totalSize > maxTeamSize) {
      showError(`Team cannot exceed ${maxTeamSize} members (including leader)`);
      return;
    }

    // Check all members have required info
    for (let i = 0; i < teamData.members.length; i++) {
      const member = teamData.members[i];
      if (!member.name.trim() || !member.email.trim()) {
        showError(`Please complete information for member ${i + 1}`);
        return;
      }
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
        showError(`Invalid email for member ${i + 1}`);
        return;
      }
    }

    if (Array.isArray(event.customFields) && event.customFields.length > 0) {
      for (const field of event.customFields) {
        const fieldKey = field.id || field._id || field.label;
        const value = customFieldResponses[fieldKey];
        const isEmpty =
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0);
        if (field.required && isEmpty) {
          showError(`${field.label} is required`);
          return;
        }
      }
    }

    const registrationData = {
      isTeam: true,
      teamName: teamData.teamName,
      teamLeader: {
        name: teamData.teamLeader,
        email: teamData.teamLeaderEmail,
      },
      teamMembers: teamData.members,
      teamSize: totalSize,
      customFields: customFieldResponses,
    };

    console.log('Submitting registration data:', registrationData);
    onSubmit(registrationData);
  };

  return (
    <div className="team-registration-form">
      <div className="form-header">
        <h2>Team Registration</h2>
        <p className="team-size-info">
          Team size: {minTeamSize} - {maxTeamSize} members (including team leader)
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Team Information */}
        <div className="form-section">
          <h3>Team Information</h3>
          
          <div className="form-group">
            <label>Team Name *</label>
            <input
              type="text"
              value={teamData.teamName}
              onChange={(e) => setTeamData({ ...teamData, teamName: e.target.value })}
              placeholder="Enter your team name"
              required
            />
          </div>
        </div>

        {/* Team Leader */}
        <div className="form-section">
          <h3>Team Leader (You)</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={teamData.teamLeader}
                onChange={(e) => setTeamData({ ...teamData, teamLeader: e.target.value })}
                placeholder="Your name"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={teamData.teamLeaderEmail}
                onChange={(e) => setTeamData({ ...teamData, teamLeaderEmail: e.target.value })}
                placeholder="Your email"
                required
              />
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="form-section">
          <div className="section-header">
            <h3>Team Members</h3>
            <span className="member-count">
              {teamData.members.length + 1} / {maxTeamSize} members
            </span>
          </div>

          {teamData.members.map((member, index) => (
            <div key={index} className="member-card">
              <div className="member-header">
                <span className="member-number">Member {index + 1}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(index)}
                  className="btn-remove-member"
                  disabled={teamData.members.length <= minTeamSize - 1}
                >
                  Remove
                </button>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                    placeholder="Member name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={member.email}
                    onChange={(e) => handleMemberChange(index, 'email', e.target.value)}
                    placeholder="Member email"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={member.phone}
                    onChange={(e) => handleMemberChange(index, 'phone', e.target.value)}
                    placeholder="Member phone"
                  />
                </div>
              </div>
            </div>
          ))}

          {teamData.members.length < maxTeamSize - 1 && (
            <button
              type="button"
              onClick={handleAddMember}
              className="btn-add-member"
            >
              + Add Team Member
            </button>
          )}

          <p className="help-text">
            Current team size: {teamData.members.length + 1} members 
            (Min: {minTeamSize}, Max: {maxTeamSize})
          </p>
        </div>

        {Array.isArray(event.customFields) && event.customFields.length > 0 && (
          <div className="form-section">
            <h3>Additional Information</h3>
            {event.customFields.map((field) => {
              const fieldKey = field.id || field._id || field.label;
              const value = customFieldResponses[fieldKey];

              if (field.type === 'textarea') {
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <textarea
                      value={value || ''}
                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                      rows="3"
                    />
                  </div>
                );
              }

              if (field.type === 'select') {
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <select
                      value={value || ''}
                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                    >
                      <option value="">Select</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (field.type === 'radio') {
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    {(field.options || []).map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name={`custom-${fieldKey}`}
                          checked={value === option}
                          onChange={() => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: option }))}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                );
              }

              if (field.type === 'checkbox') {
                const selectedValues = Array.isArray(value) ? value : [];
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    {(field.options || []).map((option) => (
                      <label key={option}>
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(option)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selectedValues, option]
                              : selectedValues.filter(v => v !== option);
                            setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: next }));
                          }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                );
              }

              if (field.type === 'file') {
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: file ? file.name : '' }));
                      }}
                    />
                  </div>
                );
              }

              return (
                <div className="form-group" key={fieldKey}>
                  <label>{field.label}{field.required ? ' *' : ''}</label>
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
                    value={value || ''}
                    onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Payment Info */}
        {event.requiresPayment && event.paymentAmount && (
          <div className="form-section payment-section">
            <h3>Payment Information</h3>
            <div className="payment-details">
              <p>
                <strong>Amount per member:</strong> ₹{event.paymentAmount}
              </p>
              <p>
                <strong>Total amount for team:</strong> ₹{event.paymentAmount * (teamData.members.length + 1)}
              </p>
              <p className="payment-note">
                Payment details will be shared after registration
              </p>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-cancel">
            Cancel
          </button>
          <button type="submit" className="btn-submit">
            Register Team
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeamRegistrationForm;
