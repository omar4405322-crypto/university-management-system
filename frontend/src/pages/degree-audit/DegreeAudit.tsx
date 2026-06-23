import React from 'react';

const DegreeAudit: React.FC = () => {
  /*
   * TODO: Restore the original Degree Audit implementation after the backend
   * endpoints for GET /degree-audit/:studentId and /degree-audit/:studentId/eligible exist.
   *
   * The previous implementation called degreeAuditService.getAudit(...) in a
   * useEffect on mount, which currently produces 404s because the backend route
   * is not implemented.
   */
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Degree Audit</h2>
      <p>This feature is under construction. Please check back soon.</p>
    </div>
  );
};

export default DegreeAudit;
