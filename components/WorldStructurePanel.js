'use client';

import { getNodesByKind } from '@/lib/worldHelpers';

export default function WorldStructurePanel() {
  const blackholes = getNodesByKind('blackhole');
  const dyson = getNodesByKind('dyson');
  const solar = getNodesByKind('solar');

  return (
    <div className="world-structure-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Structure panel</span>
        <strong>Current live world layout</strong>
      </div>

      <div className="structure-group">
        <span className="structure-title">Blackholes</span>
        <div className="structure-chip-list">
          {blackholes.map((node) => (
            <span key={node.key} className={`structure-chip ${node.key === 'matrixcoinexchange' ? 'matrix' : ''}`}>
              {node.label}
            </span>
          ))}
        </div>
      </div>

      <div className="structure-group">
        <span className="structure-title">Dyson spheres</span>
        <div className="structure-chip-list">
          {dyson.map((node) => (
            <span key={node.key} className="structure-chip">{node.label}</span>
          ))}
        </div>
      </div>

      <div className="structure-group">
        <span className="structure-title">Solar systems</span>
        <div className="structure-chip-list">
          {solar.map((node) => (
            <span key={node.key} className="structure-chip">{node.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
