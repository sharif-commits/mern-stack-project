/**
 * Normalize eligibility strings to one of: 'All', 'IIIT', 'Non-IIIT'.
 *
 * Shared utility used by eventController, registrationController, and
 * the frontend EventDetails component (which carries its own copy).
 */
const normalizeEligibility = (eligibility) => {
    if (!eligibility) return 'All';
    const value = String(eligibility).trim().toLowerCase();

    if (
        value === 'all' ||
        value === 'both' ||
        value.includes('iiit+external') ||
        value.includes('iiit & external') ||
        value.includes('iiit and external')
    ) {
        return 'All';
    }

    if (value.includes('iiit')) {
        return value.includes('non') || value.includes('external') ? 'Non-IIIT' : 'IIIT';
    }

    if (value.includes('external') || value.includes('non')) {
        return 'Non-IIIT';
    }

    return 'All';
};

module.exports = { normalizeEligibility };
