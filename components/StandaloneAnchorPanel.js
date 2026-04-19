'use client';

import { STANDALONE_ANCHOR } from '@/lib/anchorDescriptors';

export default function StandaloneAnchorPanel({ selected }) {
  const visible = selected?.key === 'deep_blackhole';

  return (
    <div className={`standalone-anchor-panel ${visible ? 'visible' : ''}`}>
      <div className="live-room-head">
        <span className="pilot-assist-kicker">{STANDALONE_ANCHOR.subtitle}</span>
        <strong>{STANDALONE_ANCHOR.title}</strong>
      </div>

      <p className="muted">{STANDALONE_ANCHOR.description}</p>

      <div className="standalone-anchor-list">
        {STANDALONE_ANCHOR.bullets.map((bullet) => (
          <div key={bullet} className="standalone-anchor-item">
            <span>•</span>
            <p>{bullet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
