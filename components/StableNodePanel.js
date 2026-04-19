'use client';

export default function StableNodePanel({ selected, lobbyMode, onClose, onOpen }) {
  if (!selected) return null;

  return (
    <div className="stable-node-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Route panel</span>
        <strong>{selected.label}</strong>
      </div>

      <p className="muted">{selected.description}</p>

      <div className="focus-meta">
        <span>{selected.address || 'No address'}</span>
        <span>{selected.kind}</span>
        <span>{lobbyMode === 'hub' ? 'Shared route' : 'Private route'}</span>
      </div>

      <div className="button-column">
        {selected.route ? (
          <button className="button primary" onClick={() => onOpen(selected)}>
            {selected.external ? 'Open destination' : 'Warp into system'}
          </button>
        ) : null}
        <button className="button secondary" onClick={onClose}>Clear selection</button>
      </div>
    </div>
  );
}
