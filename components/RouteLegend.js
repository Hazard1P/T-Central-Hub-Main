'use client';

import { ROUTE_CHIPS, WORLD_SUMMARY } from '@/lib/worldLayout';

export default function RouteLegend() {
  return (
    <div className="route-legend">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">World structure</span>
        <strong>{WORLD_SUMMARY.blackholes} blackholes • {WORLD_SUMMARY.dysonSpheres} Dyson spheres • {WORLD_SUMMARY.solarSystems} solar system</strong>
      </div>
      <div className="route-legend-chips">
        {ROUTE_CHIPS.map((chip) => (
          <span key={chip} className={`route-legend-chip ${chip === 'MatrixCoinExchange' ? 'matrix' : ''}`}>{chip}</span>
        ))}
      </div>
    </div>
  );
}
