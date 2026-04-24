import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { registrationsAPI } from '../utils/api';
import './TeamManagement.css';

const TeamManagement = () => {
  const { user } = useAuth();
  const { events } = useData();
  const { showSuccess, showError } = useToast();

  const [teams, setTeams] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingTeamId, setUpdatingTeamId] = useState(null);
  const [inviteDrafts, setInviteDrafts] = useState({});
  const [form, setForm] = useState({
    eventId: '',
    teamName: '',
    desiredTeamSize: 3,
    inviteEmails: ''
  });

  const teamEligibleEvents = useMemo(() => {
    return (events || []).filter(event => {
      const mode = event.participantType === 'Both' || event.participantType === 'Team' || event.allowTeams;
      return mode && event.type !== 'Merchandise' && event.status === 'approved';
    });
  }, [events]);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const [teamsResponse, invitesResponse] = await Promise.all([
        registrationsAPI.getMyTeams(),
        registrationsAPI.getMyPendingTeamInvites()
      ]);

      if (teamsResponse.success) {
        setTeams(teamsResponse.data || []);
      } else {
        showError(teamsResponse.message || 'Failed to load teams');
      }

      if (invitesResponse.success) {
        setPendingInvites(invitesResponse.data || []);
      } else {
        showError(invitesResponse.message || 'Failed to load team invites');
      }
    } catch (error) {
      showError(error.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!form.eventId) {
      showError('Please select an event');
      return;
    }
    if (!form.teamName.trim()) {
      showError('Team name is required');
      return;
    }

    const inviteEmails = form.inviteEmails
      .split(',')
      .map(email => email.trim())
      .filter(Boolean);

    try {
      setCreating(true);
      const response = await registrationsAPI.createTeamRegistration({
        eventId: form.eventId,
        teamName: form.teamName,
        desiredTeamSize: Number(form.desiredTeamSize),
        inviteEmails
      });

      if (!response.success) {
        showError(response.message || 'Failed to create team');
        return;
      }

      showSuccess(response.message || 'Team created successfully');
      setForm({ eventId: '', teamName: '', desiredTeamSize: 3, inviteEmails: '' });
      await loadTeams();
    } catch (error) {
      showError(error.message || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleAddInvite = async (teamId) => {
    const raw = inviteDrafts[teamId] || '';
    const inviteEmails = raw.split(',').map(email => email.trim()).filter(Boolean);

    if (!inviteEmails.length) {
      showError('Enter at least one invite email');
      return;
    }

    try {
      setUpdatingTeamId(teamId);
      const response = await registrationsAPI.addTeamInvites(teamId, inviteEmails);
      if (!response.success) {
        showError(response.message || 'Failed to add invites');
        return;
      }

      showSuccess(response.message || 'Invites added successfully');
      setInviteDrafts(prev => ({ ...prev, [teamId]: '' }));
      await loadTeams();
    } catch (error) {
      showError(error.message || 'Failed to add invites');
    } finally {
      setUpdatingTeamId(null);
    }
  };

  const handleRespondInvite = async (teamId, action) => {
    try {
      setUpdatingTeamId(teamId);
      const response = await registrationsAPI.respondToMyTeamInvite(teamId, action);

      if (!response.success) {
        showError(response.message || `Failed to ${action} invite`);
        return;
      }

      showSuccess(response.message || `Invite ${action}ed successfully`);
      await loadTeams();
    } catch (error) {
      showError(error.message || `Failed to ${action} invite`);
    } finally {
      setUpdatingTeamId(null);
    }
  };

  const handleRemoveInvite = async (teamId, inviteId) => {
    try {
      setUpdatingTeamId(teamId);
      const response = await registrationsAPI.removeTeamInvite(teamId, inviteId);
      if (!response.success) {
        showError(response.message || 'Failed to remove invite');
        return;
      }

      showSuccess('Invite removed');
      await loadTeams();
    } catch (error) {
      showError(error.message || 'Failed to remove invite');
    } finally {
      setUpdatingTeamId(null);
    }
  };

  return (
    <div className="team-management-page">
      <div className="team-header">
        <h1>Team Management</h1>
        <p>Create teams, track invites, and monitor completion status.</p>
      </div>

      <div className="team-create-card">
        <h2>Create Team Registration</h2>
        <form onSubmit={handleCreate} className="team-form-grid">
          <label>
            Event
            <select
              value={form.eventId}
              onChange={(event) => setForm(prev => ({ ...prev, eventId: event.target.value }))}
            >
              <option value="">Select a team-enabled event</option>
              {teamEligibleEvents.map(event => (
                <option key={event._id || event.id} value={event._id || event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Team Name
            <input
              type="text"
              value={form.teamName}
              onChange={(event) => setForm(prev => ({ ...prev, teamName: event.target.value }))}
              placeholder="e.g. CodeCatalysts"
            />
          </label>

          <label>
            Team Size (including leader)
            <input
              type="number"
              min="2"
              max="10"
              value={form.desiredTeamSize}
              onChange={(event) => setForm(prev => ({ ...prev, desiredTeamSize: event.target.value }))}
            />
          </label>

          <label className="full-width">
            Invite Emails (comma-separated)
            <textarea
              rows="3"
              value={form.inviteEmails}
              onChange={(event) => setForm(prev => ({ ...prev, inviteEmails: event.target.value }))}
              placeholder="member1@email.com, member2@email.com"
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Team'}
          </button>
        </form>
      </div>

      <div className="teams-list-card">
        <div className="list-header">
          <h2>Invites For Me</h2>
        </div>

        {loading ? (
          <p>Loading invites...</p>
        ) : pendingInvites.length === 0 ? (
          <p>No pending team invites.</p>
        ) : (
          <div className="teams-grid">
            {pendingInvites.map((inviteItem) => (
              <article key={inviteItem.teamId} className="team-card">
                <div className="team-card-header">
                  <h3>{inviteItem.teamName}</h3>
                  <span className="status-chip forming">pending invite</span>
                </div>
                <p><strong>Event:</strong> {inviteItem.event?.title || 'N/A'}</p>
                <p><strong>Leader:</strong> {`${inviteItem.leader?.firstName || ''} ${inviteItem.leader?.lastName || ''}`.trim()} ({inviteItem.leader?.email || 'N/A'})</p>
                <p><strong>Current Team Size:</strong> {inviteItem.members?.length || 0}/{inviteItem.desiredTeamSize}</p>

                <div className="invite-actions-inline">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={updatingTeamId === inviteItem.teamId}
                    onClick={() => handleRespondInvite(inviteItem.teamId, 'accept')}
                  >
                    {updatingTeamId === inviteItem.teamId ? 'Updating...' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={updatingTeamId === inviteItem.teamId}
                    onClick={() => handleRespondInvite(inviteItem.teamId, 'decline')}
                  >
                    Decline
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="teams-list-card">
        <div className="list-header">
          <h2>My Teams</h2>
          <button type="button" className="btn btn-secondary" onClick={loadTeams}>Refresh</button>
        </div>

        {loading ? (
          <p>Loading teams...</p>
        ) : teams.length === 0 ? (
          <p>No teams created or joined yet.</p>
        ) : (
          <div className="teams-grid">
            {teams.map(team => (
              <article key={team._id} className="team-card">
                {(() => {
                  const currentUserId = user?._id || user?.id;
                  const leaderId = team.leader?._id || team.leader;
                  const isLeader = currentUserId && leaderId && String(currentUserId) === String(leaderId);
                  return (
                    <>
                <div className="team-card-header">
                  <h3>{team.teamName}</h3>
                  <span className={`status-chip ${team.status}`}>{team.status}</span>
                </div>
                <p><strong>Event:</strong> {team.event?.title || 'N/A'}</p>
                <p><strong>Size:</strong> {team.members?.length || 0}/{team.desiredTeamSize}</p>
                <p><strong>Invite Code:</strong> {team.inviteCode}</p>

                {isLeader && team.status === 'forming' && (
                  <div className="invite-editor">
                    <input
                      type="text"
                      placeholder="Add invite emails (comma-separated)"
                      value={inviteDrafts[team._id] || ''}
                      onChange={(event) => setInviteDrafts(prev => ({ ...prev, [team._id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleAddInvite(team._id)}
                      disabled={updatingTeamId === team._id}
                    >
                      {updatingTeamId === team._id ? 'Updating...' : 'Add Invite(s)'}
                    </button>
                  </div>
                )}

                <div className="invite-tracking">
                  <h4>Invite Tracking</h4>
                  {team.inviteLinks?.length ? (
                    <ul>
                      {team.inviteLinks.map(invite => (
                        <li key={invite.id || invite.token}>
                          <div>
                            <span>{invite.email}</span>
                            <span className={`invite-status ${invite.status}`}>{invite.status}</span>
                          </div>
                          <div className="invite-actions-inline">
                            {invite.status === 'pending' && <span>Visible in-app for this email</span>}
                            {isLeader && invite.status === 'pending' && (
                              <button
                                type="button"
                                className="btn btn-danger-small"
                                onClick={() => handleRemoveInvite(team._id, invite.id || invite._id)}
                                disabled={updatingTeamId === team._id}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No invites.</p>
                  )}
                </div>

                <div className="team-members">
                  <h4>Members</h4>
                  <ul>
                    {(team.members || []).map(member => (
                      <li key={member._id || member.email}>{`${member.firstName || ''} ${member.lastName || ''}`.trim()} ({member.email})</li>
                    ))}
                  </ul>
                </div>
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="team-footer-links">
        <Link to="/events">Browse Events</Link>
      </div>
    </div>
  );
};

export default TeamManagement;
