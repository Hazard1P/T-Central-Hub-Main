'use client';

import { useState } from 'react';

export default function CopyAddressButton({ value, label = 'Copy address', className = 'button primary' }) {
  const [status, setStatus] = useState('');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Address copied.');
    } catch {
      setStatus(`Copy unavailable. Select and copy this address: ${value}`);
    }
  }

  return (
    <span className="copy-address-control">
      <button type="button" className={className} onClick={handleCopy}>{label}</button>
      <span className="copy-address-status" role="status">{status}</span>
    </span>
  );
}
