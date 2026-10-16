'use client';

import { useMemo, useState } from 'react';
import { getSystemNewsItems } from '@/lib/siteContent';

export default function SystemNewsInfoPanel({ lobbyMode = 'hub', selected = null }) {
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    const selectedItem = selected?.route && !selected?.external
      ? [{ label: `Open ${selected.label}`, href: selected.route, note: selected.description || 'Direct route from the active layer.' }]
      : [];
    return [...selectedItem, ...getSystemNewsItems()];
  }, [selected]);

  return (
    <div className={`system-news-panel ${open ? 'open' : 'collapsed'}`}>
      <button
        className="system-news-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Collapse News and Info' : 'Expand News and Info'}
      >
        <span>News & Info</span>
        <strong>{open ? '−' : '+'}</strong>
      </button>

      {open ? (
        <div className="system-news-card">
          <div className="system-news-head">
            <span className="pilot-assist-kicker">Layer brief</span>
            <strong>{lobbyMode === 'hub' ? 'Shared system feed' : 'Private system feed'}</strong>
          </div>

          <p className="system-news-copy">
            Keep the core routes, world updates, and support surfaces visible while navigating the webgame shell.
          </p>

          <div className="system-news-list">
            {items.map((item) => (
              <a className="system-news-link" href={item.href} key={`${item.label}-${item.href}`}>
                <span>{item.label}</span>
                <small>{item.note}</small>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
