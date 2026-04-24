import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/helpers';
import { adminAPI } from '../utils/api';
import { ORGANIZER_CATEGORIES } from '../utils/constants';
import './UserManagement.css';

const initialOrganizer = {
  firstName: '',
  lastName: '',
  email: '',
  contactNumber: '',
  organizerName: '',
  category: '',
  description: '',
  contactEmail: '',
  contactPhone: ''
};

const UserManagement = () => {
  const { showSuccess, showError } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrganizer, setNewOrganizer] = useState(initialOrganizer);
  const [newOrganizerErrors, setNewOrganizerErrors] = useState({});
  const [createdCreds, setCreatedCreds] = useState(null);
  const [resetCreds, setResetCreds] = useState(null);
  const [resetRequests, setResetRequests] = useState([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [selectedResetRequest, setSelectedResetRequest] = useState(null);
  const [resetActionComment, setResetActionComment] = useState('');
  const [reviewingResetRequest, setReviewingResetRequest] = useState(false);

  // Load users from backend
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [usersRes, resetRes] = await Promise.all([
          adminAPI.getAllUsers(),
          adminAPI.getPasswordResetRequests('all')
        ]);

        if (usersRes.success) {
          setUsers(usersRes.data || []);
        }

        if (resetRes.success) {
          setResetRequests(resetRes.data || []);
        }
      } catch (err) {
        showError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [showError]);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive !== false).length;
    const participants = users.filter(u => u.role === 'Participant').length;
    const organizers = users.filter(u => u.role === 'Organizer').length;
    const admins = users.filter(u => u.role === 'Admin').length;
    return { totalUsers, activeUsers, participants, organizers, admins };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        (`${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()).includes(searchTerm.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.isActive !== false) ||
        (statusFilter === 'inactive' && user.isActive === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const handleViewDetails = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleToggleStatus = (user) => {
    const newStatus = user.isActive !== false ? false : true;
    adminAPI.updateUser(user._id, { isActive: newStatus })
      .then(() => {
        setUsers(prev => prev.map(u => u._id === user._id ? { ...u, isActive: newStatus } : u));
        showSuccess(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      })
      .catch(() => showError('Failed to update user status'));
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      adminAPI.deleteUser(userToDelete._id)
        .then(() => {
          setUsers(prev => prev.filter(u => u._id !== userToDelete._id));
          showSuccess('User deactivated successfully');
        })
        .catch(() => showError('Failed to deactivate user'))
        .finally(() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        });
    }
  };

  const handleDeletePermanent = () => {
    if (userToDelete) {
      adminAPI.deleteUserPermanent(userToDelete._id)
        .then(() => {
          setUsers(prev => prev.filter(u => u._id !== userToDelete._id));
          showSuccess('User permanently deleted');
        })
        .catch(() => showError('Failed to delete user permanently'))
        .finally(() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        });
    }
  };

  const handleResetPassword = async (user) => {
    try {
      const res = await adminAPI.resetOrganizerPassword(user._id);
      if (res.success) {
        setResetCreds(res.credentials);
        showSuccess(`Password reset for ${user.email}`);
      } else {
        showError(res.message || 'Failed to reset password');
      }
    } catch (err) {
      showError(err.message || 'Failed to reset password');
    }
  };

  const handleReviewResetRequest = async (action) => {
    if (!selectedResetRequest) return;

    try {
      setReviewingResetRequest(true);
      const response = await adminAPI.reviewPasswordResetRequest(selectedResetRequest._id, {
        action,
        comment: resetActionComment
      });

      if (!response.success) {
        showError(response.message || 'Failed to review request');
        return;
      }

      setResetRequests((prev) => prev.map((item) => (
        item._id === selectedResetRequest._id ? response.data : item
      )));

      if (response.credentials) {
        setResetCreds(response.credentials);
      }

      showSuccess(response.message || `Request ${action}d`);
      setSelectedResetRequest(null);
      setResetActionComment('');
    } catch (error) {
      showError(error.message || 'Failed to review request');
    } finally {
      setReviewingResetRequest(false);
    }
  };

  const filteredResetRequests = useMemo(() => {
    if (requestStatusFilter === 'all') return resetRequests;
    return resetRequests.filter((request) => (request.status || '').toLowerCase() === requestStatusFilter.toLowerCase());
  }, [resetRequests, requestStatusFilter]);

  const validateOrganizer = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!newOrganizer.firstName.trim()) errors.firstName = 'First name is required';
    if (!newOrganizer.lastName.trim()) errors.lastName = 'Last name is required';
    if (newOrganizer.email && !emailRegex.test(newOrganizer.email)) errors.email = 'Enter a valid email';
    if (!newOrganizer.contactNumber.trim()) errors.contactNumber = 'Contact number is required';
    if (!newOrganizer.organizerName.trim()) errors.organizerName = 'Organizer name is required';
    if (!newOrganizer.category.trim()) errors.category = 'Category is required';
    if (!newOrganizer.description.trim()) errors.description = 'Description is required';
    if (!newOrganizer.contactEmail.trim()) errors.contactEmail = 'Contact email is required';
    if (newOrganizer.contactEmail && !emailRegex.test(newOrganizer.contactEmail)) {
      errors.contactEmail = 'Enter a valid contact email';
    }

    setNewOrganizerErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOrganizer = async () => {
    try {
      if (!validateOrganizer()) {
        showError('Please fix the form errors');
        return;
      }
      setCreating(true);
      const res = await adminAPI.createOrganizer(newOrganizer);
      if (res.success) {
        setUsers(prev => [...prev, res.data]);
        // Backend always returns credentials (auto-generated email if blank, always auto-generated password)
        setCreatedCreds(res.credentials);
        showSuccess('Organizer created. Copy the credentials below and share with the organizer.');
        setNewOrganizer(initialOrganizer);
        setNewOrganizerErrors({});
      }
    } catch (err) {
      showError(err.message || 'Failed to create organizer');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="user-management">
      <div className="page-header">
        <h1>Password Reset Requests & Organizer Accounts</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><h3>{stats.totalUsers}</h3><p>Total Users</p></div>
        <div className="stat-card"><h3>{stats.activeUsers}</h3><p>Active Users</p></div>
        <div className="stat-card"><h3>{stats.participants}</h3><p>Participants</p></div>
        <div className="stat-card"><h3>{stats.organizers}</h3><p>Organizers</p></div>
        <div className="stat-card"><h3>{stats.admins}</h3><p>Admins</p></div>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <label>Role:</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="Participant">Participants</option>
              <option value="Organizer">Organizers</option>
              <option value="Admin">Admins</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="empty-state">Loading users...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  <p>No users found</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user._id}>
                  <td>
                    <div className="user-info">
                      <strong>{user.name || `${user.firstName || ''} ${user.lastName || ''}`}</strong>
                      {user.rollNumber && <span className="roll-number">{user.rollNumber}</span>}
                    </div>
                  </td>
                  <td>{user.email || 'N/A'}</td>
                  <td><span className={`role-badge role-${(user.role || '').toLowerCase()}`}>{user.role}</span></td>
                  <td><span className={`status-badge status-${user.isActive !== false ? 'active' : 'inactive'}`}>{user.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                  <td>{formatDate(user.createdAt || new Date())}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-view" onClick={() => handleViewDetails(user)} title="View Details">👁️</button>
                      <button className={`btn-toggle ${user.isActive !== false ? 'active' : ''}`} onClick={() => handleToggleStatus(user)} title={user.isActive !== false ? 'Deactivate' : 'Activate'}>
                        {user.isActive !== false ? '🔓' : '🔒'}
                      </button>
                      <button className="btn-delete" onClick={() => handleDeleteClick(user)} title="Deactivate User">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="users-table-container reset-requests-block">
        <div className="filters-section compact">
          <h2>Organizer Password Reset Requests</h2>
          <div className="filters-row">
            <div className="filter-group">
              <label>Request Status:</label>
              <select value={requestStatusFilter} onChange={(e) => setRequestStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        <table className="users-table">
          <thead>
            <tr>
              <th>Organizer</th>
              <th>Club</th>
              <th>Requested</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredResetRequests.length === 0 ? (
              <tr><td colSpan="6" className="empty-state">No password reset requests</td></tr>
            ) : (
              filteredResetRequests.map((request) => (
                <tr key={request._id}>
                  <td>{request.organizerMeta?.organizerName || `${request.organizer?.firstName || ''} ${request.organizer?.lastName || ''}`}</td>
                  <td>{request.organizerMeta?.clubName || request.organizer?.organizerProfile?.name || 'N/A'}</td>
                  <td>{formatDate(request.requestedAt)}</td>
                  <td>{request.reason}</td>
                  <td><span className={`status-badge status-${(request.status || '').toLowerCase()}`}>{request.status}</span></td>
                  <td>
                    {request.status === 'Pending' ? (
                      <button className="btn-view" onClick={() => setSelectedResetRequest(request)} title="Review Request">📝</button>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Details</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h3>Basic Information</h3>
                <div className="detail-row"><span className="label">Name:</span><span className="value">{selectedUser.name || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`}</span></div>
                <div className="detail-row"><span className="label">Email:</span><span className="value">{selectedUser.email}</span></div>
                <div className="detail-row"><span className="label">Role:</span><span className="value"><span className={`role-badge role-${(selectedUser.role || '').toLowerCase()}`}>{selectedUser.role}</span></span></div>
                <div className="detail-row"><span className="label">Status:</span><span className="value"><span className={`status-badge status-${selectedUser.isActive !== false ? 'active' : 'inactive'}`}>{selectedUser.isActive !== false ? 'Active' : 'Inactive'}</span></span></div>
                <div className="detail-row"><span className="label">Joined:</span><span className="value">{formatDate(selectedUser.createdAt || new Date())}</span></div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => handleResetPassword(selectedUser)}>Reset Password</button>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Close</button>
            </div>
            {resetCreds && (
              <div className="credentials-box">
                <p><strong>New Credentials</strong></p>
                <p>Email: {resetCreds.email}</p>
                <p>Password: {resetCreds.password}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteModal && userToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Deactivate</h2>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Deactivate <strong>{userToDelete.name || `${userToDelete.firstName || ''} ${userToDelete.lastName || ''}`}</strong>?</p>
              <p className="warning-text">This will disable login for the user.</p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteConfirm}>Deactivate</button>
              <button className="btn-danger" onClick={handleDeletePermanent}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {selectedResetRequest && (
        <div className="modal-overlay" onClick={() => setSelectedResetRequest(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Password Reset Request</h2>
              <button className="modal-close" onClick={() => setSelectedResetRequest(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row"><span className="label">Organizer:</span><span className="value">{selectedResetRequest.organizerMeta?.organizerName || selectedResetRequest.organizer?.email}</span></div>
              <div className="detail-row"><span className="label">Club:</span><span className="value">{selectedResetRequest.organizerMeta?.clubName || 'N/A'}</span></div>
              <div className="detail-row"><span className="label">Date:</span><span className="value">{formatDate(selectedResetRequest.requestedAt)}</span></div>
              <div className="detail-row"><span className="label">Reason:</span><span className="value">{selectedResetRequest.reason}</span></div>
              <label className="form-group">
                Admin Comment
                <textarea
                  rows="3"
                  value={resetActionComment}
                  onChange={(e) => setResetActionComment(e.target.value)}
                  placeholder="Optional comment for approval/rejection"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setSelectedResetRequest(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleReviewResetRequest('reject')} disabled={reviewingResetRequest}>Reject</button>
              <button className="btn-primary" onClick={() => handleReviewResetRequest('approve')} disabled={reviewingResetRequest}>Approve & Generate Password</button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !createdCreds && setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{createdCreds ? 'Organizer Created – Share These Credentials' : 'Create Organizer'}</h2>
              <button className="modal-close" onClick={() => { setShowCreateModal(false); setCreatedCreds(null); }}>×</button>
            </div>
            <div className="modal-body">
              {createdCreds ? (
                <div className="credentials-box credentials-box-prominent">
                  <p><strong>System-generated login (share with the organizer)</strong></p>
                  <p><strong>Email:</strong> <code>{createdCreds.email}</code></p>
                  <p><strong>Password:</strong> <code>{createdCreds.password}</code></p>
                  <p className="warning-text">Copy and share these securely now. They cannot be retrieved later.</p>
                </div>
              ) : (
                <>
              <p className="form-hint">The system will auto-generate a login email if you leave it blank, and will always auto-generate a password. Both will be shown after you click Create Organizer.</p>
              <div className="form-section">
                <h3 className="section-title">Account</h3>
                <div className="form-grid">
                  <label className="form-group">
                    First Name *
                    <input
                      value={newOrganizer.firstName}
                      onChange={e => {
                        setNewOrganizer({ ...newOrganizer, firstName: e.target.value });
                        setNewOrganizerErrors(prev => ({ ...prev, firstName: '' }));
                      }}
                      className={newOrganizerErrors.firstName ? 'input-error' : ''}
                    />
                    {newOrganizerErrors.firstName && <span className="error-text">{newOrganizerErrors.firstName}</span>}
                  </label>
                  <label className="form-group">
                    Last Name *
                    <input
                      value={newOrganizer.lastName}
                      onChange={e => {
                        setNewOrganizer({ ...newOrganizer, lastName: e.target.value });
                        setNewOrganizerErrors(prev => ({ ...prev, lastName: '' }));
                      }}
                      className={newOrganizerErrors.lastName ? 'input-error' : ''}
                    />
                    {newOrganizerErrors.lastName && <span className="error-text">{newOrganizerErrors.lastName}</span>}
                  </label>
                  <label className="form-group">
                    Login Email (optional – leave blank for system to auto-generate)
                    <input
                      type="email"
                      value={newOrganizer.email}
                      onChange={e => {
                        setNewOrganizer({ ...newOrganizer, email: e.target.value });
                        setNewOrganizerErrors(prev => ({ ...prev, email: '' }));
                      }}
                      className={newOrganizerErrors.email ? 'input-error' : ''}
                      placeholder="Leave blank to auto-generate"
                    />
                    {newOrganizerErrors.email && <span className="error-text">{newOrganizerErrors.email}</span>}
                  </label>
                  <label className="form-group">
                    Contact Number *
                    <input
                      value={newOrganizer.contactNumber}
                      onChange={e => {
                        setNewOrganizer({ ...newOrganizer, contactNumber: e.target.value });
                        setNewOrganizerErrors(prev => ({ ...prev, contactNumber: '' }));
                      }}
                      className={newOrganizerErrors.contactNumber ? 'input-error' : ''}
                    />
                    {newOrganizerErrors.contactNumber && <span className="error-text">{newOrganizerErrors.contactNumber}</span>}
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title">Organizer Profile</h3>
                <div className="form-grid">
                  <label className="form-group">
                    Organizer Name *
                    <input
                      value={newOrganizer.organizerName}
                      onChange={e => {
                        setNewOrganizer({ ...newOrganizer, organizerName: e.target.value });
                        setNewOrganizerErrors(prev => ({ ...prev, organizerName: '' }));
                      }}
                      className={newOrganizerErrors.organizerName ? 'input-error' : ''}
                    />
                    {newOrganizerErrors.organizerName && <span className="error-text">{newOrganizerErrors.organizerName}</span>}
                  </label>
                  <label className="form-group">
                    Category *
                    <select
                      value={newOrganizer.category}
                      onChange={e => {
                        setNewOrganizer({ ...newOrganizer, category: e.target.value });
                        setNewOrganizerErrors(prev => ({ ...prev, category: '' }));
                      }}
                      className={newOrganizerErrors.category ? 'input-error' : ''}
                    >
                      <option value="">Select</option>
                      {ORGANIZER_CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    {newOrganizerErrors.category && <span className="error-text">{newOrganizerErrors.category}</span>}
                  </label>
                  <label className="form-group full-width">
                    Description *
                    <textarea
                      value={newOrganizer.description}
                      onChange={e => {
                        setNewOrganizer({ ...newOrganizer, description: e.target.value });
                        setNewOrganizerErrors(prev => ({ ...prev, description: '' }));
                      }}
                      className={newOrganizerErrors.description ? 'input-error' : ''}
                    />
                    {newOrganizerErrors.description && <span className="error-text">{newOrganizerErrors.description}</span>}
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title">Public Contact</h3>
                <div className="form-grid">
                  <label className="form-group">
                    Contact Email *
                    <input
                      type="email"
                      value={newOrganizer.contactEmail}
                      onChange={e => {
                        setNewOrganizer({ ...newOrganizer, contactEmail: e.target.value });
                        setNewOrganizerErrors(prev => ({ ...prev, contactEmail: '' }));
                      }}
                      className={newOrganizerErrors.contactEmail ? 'input-error' : ''}
                    />
                    {newOrganizerErrors.contactEmail && <span className="error-text">{newOrganizerErrors.contactEmail}</span>}
                  </label>
                  <label className="form-group">
                    Contact Phone
                    <input
                      value={newOrganizer.contactPhone}
                      onChange={e => setNewOrganizer({ ...newOrganizer, contactPhone: e.target.value })}
                    />
                  </label>
                </div>
              </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              {createdCreds ? (
                <button className="btn-primary" onClick={() => { setShowCreateModal(false); setCreatedCreds(null); }}>Done</button>
              ) : (
                <>
                  <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button className="btn-primary" disabled={creating} onClick={handleCreateOrganizer}>{creating ? 'Creating...' : 'Create Organizer'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="floating-action">
        <button
          className="btn-primary"
          onClick={() => {
            setShowCreateModal(true);
            setCreatedCreds(null);
            setNewOrganizerErrors({});
          }}
        >
          + Create Organizer
        </button>
      </div>
    </div>
  );
};

export default UserManagement;
