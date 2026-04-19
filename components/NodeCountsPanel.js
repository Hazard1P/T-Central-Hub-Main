'use client';

import { WORLD_SUMMARY } from '@/lib/worldLayout';
import { getFeaturedRoutes, getKindLabel } from '@/lib/worldDescriptors';

export default function NodeCountsPanel() {
  const featured = getFeaturedRoutes();

  return (
    <div className="node-counts-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">System registry</span>
        <strong>Overall world build</strong>
      </div>

      <div className="node-count-grid">
        <div><span>Blackholes</span><strong>{WORLD_SUMMARY.blackholes}</strong></div>
        <div><span>Dyson spheres</span><strong>{WORLD_SUMMARY.dysonSpheres}</strong></div>
        <div><span>Solar systems</span><strong>{WORLD_SUMMARY.solarSystems}</strong></div>
      </div>

      <div className="node-feature-list">
        {featured.map((node) => (
          <div key={node.key} className={`node-feature-item ${node.key === 'matrixcoinexchange' ? 'matrix' : ''}`}>
            <strong>{node.label}</strong>
            <span>{getKindLabel(node.kind)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
