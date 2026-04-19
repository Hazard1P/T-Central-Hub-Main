'use client';

import { getWorldHeadline } from '@/lib/worldDescriptors';

export default function SystemConsolePanel({ mode, freeFly }) {
  return (
    <div className="system-console-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">System console</span>
        <strong>{getWorldHeadline()}</strong>
      </div>
      <div className="console-line"><span>Status layer</span><strong>{mode === 'remote' ? 'Live' : mode}</strong></div>
      <div className="console-line"><span>Flight role</span><strong>{freeFly ? 'Pilot' : 'Spectate'}</strong></div>
      <div className="console-line"><span>State</span><strong>Shared world active</strong></div>
    </div>
  );
}
