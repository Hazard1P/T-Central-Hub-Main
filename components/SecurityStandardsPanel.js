'use client';

import { SECURITY_CONFIG } from '@/lib/securityConfig';

export default function SecurityStandardsPanel() {
  return (
    <div className="security-standards-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Security baseline</span>
        <strong>Encryption and standards</strong>
      </div>

      <div className="security-standard-list">
        <div className="security-standard-item"><span>Transport</span><strong>{SECURITY_CONFIG.transport}</strong></div>
        <div className="security-standard-item"><span>Stored data</span><strong>{SECURITY_CONFIG.encryption}</strong></div>
        <div className="security-standard-item"><span>Isolation</span><strong>{SECURITY_CONFIG.lobbyIsolation}</strong></div>
      </div>

      <p className="security-standards-copy">
        Public hub presence and private world state are treated separately. Sensitive state should be encrypted at rest and transported only over secure sessions.
      </p>
    </div>
  );
}
