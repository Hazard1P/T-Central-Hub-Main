'use client';

import { useId, useState } from 'react';

export default function ExpandableDock({
  title,
  kicker = null,
  summary = null,
  defaultOpen = false,
  className = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <section className={`expandable-dock ${open ? 'open' : 'collapsed'} ${className}`.trim()}>
      <button
        type="button"
        className="expandable-dock-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
      >
        <div className="expandable-dock-heading">
          {kicker ? <span className="expandable-dock-kicker">{kicker}</span> : null}
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </div>
        <span className="expandable-dock-indicator" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      <div id={id} className="expandable-dock-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
