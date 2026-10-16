'use client';

import CopyAddressButton from '@/components/CopyAddressButton';

export default function ServerConnectActions({
  serverIp,
  steamAppId = '107410',
  launchLabel = 'Launch Game',
  connectLabel = 'Quick Connect',
  className = '',
}) {
  return (
    <div className={`arma-action-stack ${className}`.trim()}>
      <a className="button secondary" href={`steam://run/${steamAppId}`}>
        {launchLabel}
      </a>
      <a className="button primary" href={`steam://connect/${serverIp}`}>
        {connectLabel}
      </a>
      <CopyAddressButton value={serverIp} label="Copy server address" className="button secondary" />
      <small className="muted">Launch and connect open the Steam desktop app. You can also copy the address to join in-game.</small>
    </div>
  );
}
