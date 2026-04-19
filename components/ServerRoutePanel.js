'use client';

export default function ServerRoutePanel({ selected }) {
  const label = selected?.label || 'No route selected';
  const description = selected?.description || 'Move through the shared system and select a route to reveal the next destination.';
  const address = selected?.address || selected?.sublabel || 'Awaiting route focus';

  return (
    <div className="server-route-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Route focus</span>
        <strong>{label}</strong>
      </div>
      <div className="server-route-body">
        <p>{description}</p>
        <div className="server-route-meta">
          <span>{address}</span>
        </div>
      </div>
    </div>
  );
}
