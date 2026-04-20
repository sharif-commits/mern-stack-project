import { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { registrationsAPI } from '../utils/api';
import { formatDate } from '../utils/helpers';
import './PaymentApproval.css';

const PaymentApproval = () => {
  const { user } = useAuth();
  const { events } = useData();
  const { showSuccess, showError } = useToast();

  const [filterStatus, setFilterStatus] = useState('pending');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const getApprovalStatus = (registration) => {
    if (registration.paymentApprovalStatus) {
      return registration.paymentApprovalStatus;
    }
    if (registration.paymentStatus === 'paid') return 'approved';
    if (registration.paymentStatus === 'failed') return 'rejected';
    return 'pending';
  };

  const getPaymentProofUrl = (proofPath) => {
    if (!proofPath) return '';
    if (/^https?:\/\//i.test(proofPath)) return proofPath;

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    let origin = 'http://localhost:5000';
    try {
      origin = new URL(apiBase).origin;
    } catch (_) {
      origin = 'http://localhost:5000';
    }

    const normalizedPath = proofPath.startsWith('/') ? proofPath : `/${proofPath}`;
    return `${origin}${normalizedPath}`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await registrationsAPI.getOrganizerRegistrations();
        if (res.success) {
          setRegistrations(res.data || res.registrations || []);
        } else {
          showError(res.message || 'Failed to load payments');
        }
      } catch (err) {
        console.error('Error fetching payments', err);
        showError('Failed to load payments');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [showError]);

  // Get organizer's events that require payment
  const paymentEvents = useMemo(() => {
    const organizerId = user?._id || user?.id;
    if (!organizerId) return [];
    return events.filter(e => {
      const orgId = e.organizer?._id || e.organizer || e.organizerId;
      return orgId === organizerId && (e.requiresPayment || (e.registrationFee || 0) > 0);
    });
  }, [events, user]);

  // Get all paid registrations (excluding free)
  const allPaidRegistrations = useMemo(() => {
    const eventIds = paymentEvents.map(e => (e._id || e.id)?.toString());
    return registrations
      .filter(reg => {
        const regEventId = (reg.event?._id || reg.event || reg.eventId)?.toString();
        return eventIds.includes(regEventId);
      })
      .filter(reg => reg.paymentStatus !== 'free')
      .map(reg => ({
        ...reg,
        event: reg.event && reg.event.title ? reg.event : paymentEvents.find(e => (e.id || e._id) === (reg.event?._id || reg.eventId || reg.event))
      }))
      .sort((a, b) => new Date(b.registeredAt || b.createdAt) - new Date(a.registeredAt || a.createdAt));
  }, [registrations, paymentEvents]);

  // Payment registrations visible to organizer (proof uploaded)
  const paymentRegistrations = useMemo(() => {
    return allPaidRegistrations.filter(reg => (reg.paymentApprovalStatus || 'pending') !== 'awaiting-proof');
  }, [allPaidRegistrations]);

  // Filter payments
  const filteredPayments = useMemo(() => {
    let filtered = paymentRegistrations;

    if (selectedEventFilter !== 'all') {
      filtered = filtered.filter(p => {
        const regEventId = (p.event?._id || p.event || p.eventId)?.toString();
        return regEventId === selectedEventFilter;
      });
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => getApprovalStatus(p) === filterStatus);
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        (p.participantName?.toLowerCase() || '').includes(search) ||
        (p.email?.toLowerCase() || '').includes(search) ||
        (p.transactionId?.toLowerCase() || '').includes(search)
      );
    }

    return filtered;
  }, [paymentRegistrations, selectedEventFilter, filterStatus, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = paymentRegistrations.length;
    const pending = paymentRegistrations.filter(p => getApprovalStatus(p) === 'pending').length;
    const approved = paymentRegistrations.filter(p => getApprovalStatus(p) === 'approved').length;
    const rejected = paymentRegistrations.filter(p => getApprovalStatus(p) === 'rejected').length;
    const awaitingProof = allPaidRegistrations.filter(p => (p.paymentApprovalStatus || '') === 'awaiting-proof').length;
    const totalRevenue = paymentRegistrations
      .filter(p => p.paymentStatus === 'paid')
      .reduce((sum, p) => sum + (p.amountPaid || p.paymentAmount || p.event?.paymentAmount || 0), 0);

    return { total, pending, approved, rejected, awaitingProof, totalRevenue };
  }, [paymentRegistrations, allPaidRegistrations]);

  const handleApprove = async (paymentId, paymentAmount) => {
    try {
      const res = await registrationsAPI.updatePayment(paymentId, {
        paymentStatus: 'paid',
        paymentApprovalStatus: 'approved',
        amountPaid: paymentAmount
      });
      if (res.success) {
        const updated = res.data;
        setRegistrations(prev => prev.map(r => (r._id === paymentId || r.id === paymentId ? updated : r)));
        showSuccess('Payment approved successfully');
      }
    } catch (err) {
      console.error('Error approving payment', err);
      showError('Failed to approve payment');
    } finally {
      setShowDetailModal(false);
    }
  };

  const handleReject = async (paymentId) => {
    try {
      const res = await registrationsAPI.updatePayment(paymentId, {
        paymentStatus: 'failed',
        paymentApprovalStatus: 'rejected'
      });
      if (res.success) {
        const updated = res.data;
        setRegistrations(prev => prev.map(r => (r._id === paymentId || r.id === paymentId ? updated : r)));
        showSuccess('Payment rejected');
      }
    } catch (err) {
      console.error('Error rejecting payment', err);
      showError('Failed to reject payment');
    } finally {
      setShowDetailModal(false);
    }
  };

  const handleViewDetails = (payment) => {
    setSelectedPayment(payment);
    setShowDetailModal(true);
  };

  return (
    <div className="payment-approval">
      <div className="page-header">
        <h1>Payment Approvals</h1>
        <p>Verify and approve participant payments</p>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card pending">
          <h3>{stats.pending}</h3>
          <p>Pending Verification</p>
        </div>
        <div className="stat-card approved">
          <h3>{stats.approved}</h3>
          <p>Approved</p>
        </div>
        <div className="stat-card rejected">
          <h3>{stats.rejected}</h3>
          <p>Rejected</p>
        </div>
        {stats.awaitingProof > 0 && (
          <div className="stat-card awaiting">
            <h3>{stats.awaitingProof}</h3>
            <p>Awaiting Proof Upload</p>
          </div>
        )}
        <div className="stat-card revenue">
          <h3>₹{stats.totalRevenue.toLocaleString()}</h3>
          <p>Total Revenue</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name, email, or transaction ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <label>Event:</label>
            <select value={selectedEventFilter} onChange={(e) => setSelectedEventFilter(e.target.value)}>
              <option value="all">All Events</option>
              {paymentEvents.map(event => (
                <option key={event._id || event.id} value={event._id || event.id}>{event.title}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Status:</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Grid */}
      {loading ? (
        <div className="empty-state"><p>Loading payments...</p></div>
      ) : filteredPayments.length === 0 ? (
        <div className="empty-state">
          <p>No payment records found</p>
        </div>
      ) : (
        <div className="payments-grid">
          {filteredPayments.map(payment => (
            <div key={payment._id || payment.id} className="payment-card">
              <div className="payment-header">
                <div>
                  <h3>{payment.participantName}</h3>
                  <p className="payment-email">{payment.email}</p>
                </div>
                <span className={`payment-status status-${getApprovalStatus(payment)}`}>
                  {getApprovalStatus(payment)}
                </span>
              </div>

              <div className="payment-details">
                <div className="detail-row">
                  <span className="label">Event:</span>
                  <span className="value">{payment.event?.title}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Amount:</span>
                  <span className="value amount">₹{payment.amountPaid || payment.paymentAmount || payment.event?.paymentAmount || 0}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Registered:</span>
                  <span className="value">{formatDate(payment.registeredAt || payment.createdAt)}</span>
                </div>
                {payment.transactionId && (
                  <div className="detail-row">
                    <span className="label">Transaction ID:</span>
                    <span className="value transaction-id">{payment.transactionId}</span>
                  </div>
                )}
              </div>

              {payment.paymentScreenshot && (
                <div className="payment-screenshot">
                  <img src={getPaymentProofUrl(payment.paymentScreenshot)} alt="Payment proof" />
                </div>
              )}

              <div className="payment-actions">
                <button
                  className="btn-view"
                  onClick={() => handleViewDetails(payment)}
                >
                  View Details
                </button>
                {getApprovalStatus(payment) === 'pending' && (
                  <>
                    <button
                      className="btn-approve"
                      onClick={() => handleApprove(payment._id || payment.id, payment.paymentAmount || payment.amountPaid || payment.event?.paymentAmount)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => handleReject(payment._id || payment.id)}
                    >
                      ✗ Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPayment && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Payment Details</h2>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Participant Information</h3>
                <div className="detail-row">
                  <span className="label">Name:</span>
                  <span className="value">{selectedPayment.participantName}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Email:</span>
                  <span className="value">{selectedPayment.email}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Phone:</span>
                  <span className="value">{selectedPayment.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="detail-section">
                <h3>Payment Information</h3>
                <div className="detail-row">
                  <span className="label">Event:</span>
                  <span className="value">{selectedPayment.event?.title}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Amount:</span>
                  <span className="value amount">₹{selectedPayment.amountPaid || selectedPayment.paymentAmount || selectedPayment.event?.paymentAmount || 0}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Status:</span>
                  <span className="value">
                    <span className={`payment-status status-${getApprovalStatus(selectedPayment)}`}>
                      {getApprovalStatus(selectedPayment)}
                    </span>
                  </span>
                </div>
                {selectedPayment.transactionId && (
                  <div className="detail-row">
                    <span className="label">Transaction ID:</span>
                    <span className="value transaction-id">{selectedPayment.transactionId}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="label">Registered At:</span>
                  <span className="value">{formatDate(selectedPayment.registeredAt || selectedPayment.createdAt)}</span>
                </div>
              </div>

              {selectedPayment.paymentScreenshot && (
                <div className="detail-section">
                  <h3>Payment Proof</h3>
                  <div className="screenshot-large">
                    <img src={getPaymentProofUrl(selectedPayment.paymentScreenshot)} alt="Payment proof" className="payment-proof-image" />
                  </div>
                </div>
              )}

              {selectedPayment.rejectionReason && (
                <div className="detail-section rejection">
                  <h3>Rejection Reason</h3>
                  <p>{selectedPayment.rejectionReason}</p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              {getApprovalStatus(selectedPayment) === 'pending' && (
                <>
                  <button
                    className="btn-approve-modal"
                    onClick={() => handleApprove(selectedPayment._id || selectedPayment.id, selectedPayment.paymentAmount || selectedPayment.amountPaid || selectedPayment.event?.paymentAmount)}
                  >
                    Approve Payment
                  </button>
                  <button
                    className="btn-reject-modal"
                    onClick={() => handleReject(selectedPayment._id || selectedPayment.id)}
                  >
                    Reject Payment
                  </button>
                </>
              )}
              <button className="btn-secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentApproval;
