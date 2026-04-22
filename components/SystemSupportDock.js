'use client';

import Link from 'next/link';
import { useSteamSession } from '@/components/SteamSessionProvider';

export default function SystemSupportDock() {
  const { steamUser, support } = useSteamSession();

  return (
    <div className="content-card support-mini-card">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Support lane</span>
        <strong>Donation + subscription access</strong>
      </div>

      <p className="muted">
        Support remains routed through protected donation and subscription pages. It stays outside the playable HUD so the game shell remains clean while donations, memberships, and receipts still work.
      </p>

      <div className="stable-chip-row alt">
        <span>{steamUser?.steamid ? 'Steam-linked support ready' : 'Guest browsing only'}</span>
        <span>{support?.reference ? `Support ${support.reference}` : 'No linked support receipt'}</span>
      </div>

      <div className="support-mini-actions">
        <Link className="stable-route-button compact" href="/donate">Open donate</Link>
        <Link className="stable-route-button compact" href="/information">View membership info</Link>
      </div>
    </div>
  );
}
