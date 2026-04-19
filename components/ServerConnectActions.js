'use client';

import { useState } from 'react';

export default function ServerConnectActions({
  serverIp,
  steamAppId = '107410',
  launchLabel = 'Launch Game',
  connectLabel = 'Quick Connect',
  className = '',
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serverIp);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`arma-action-stack ${className}`.trim()}>
      <a className="button secondary" href={`steam://run/${steamAppId}`}>
        {launchLabel}
      </a>
      <a className="button primary" href={`steam://connect/${serverIp}`}>
        {connectLabel}
      </a>
      <button className="button secondary" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy IP'}
      </button>
    </div>
  );
}
