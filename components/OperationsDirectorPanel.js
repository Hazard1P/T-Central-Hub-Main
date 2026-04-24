'use client';

import { useState } from 'react';

function Section({ title, kicker, items }) {
  return (
    <section className="operations-section">
      <div className="operations-section-head">
        <span>{kicker}</span>
        <strong>{title}</strong>
      </div>
      <div className="operations-list">
        {items.map((item) => (
          <article className={`operations-item ${item.complete ? 'is-complete' : ''}`} key={item.id}>
            <div className="operations-item-head">
              <strong>{item.title}</strong>
              <span>{item.statusLabel}</span>
            </div>
            <p>{item.description}</p>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatCoverage(value = 0) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

const MISSION_TARGETS = [
  { value: 'deep_blackhole', label: 'Deep Space Blackhole' },
  { value: 'entropic_node', label: 'Entropic Node' },
  { value: 'rust_anchor', label: 'Rust Anchor Blackhole' },
  { value: 'arma3', label: 'Arma3 Blackhole' },
  { value: 'matrixcoinexchange', label: 'MatrixCoinExchange Lane' },
];

const MISSION_TYPES = [
  { value: 'blackhole-seal', label: 'Selective blackhole lock' },
  { value: 'entropic-gather', label: 'Entropic credit gathering' },
  { value: 'recon-route', label: 'Route recon and relay' },
];

export default function OperationsDirectorPanel({ operations, lobbyMode = 'hub', validationSummary = null }) {
  if (!operations) return null;
  const [open, setOpen] = useState(true);

  return (
    <div className="content-card stable-card operations-director-card stable-card-layer systems-layer">
      <button
        type="button"
        className="panel-minimize-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Minimize operations director panel' : 'Expand operations director panel'}
      >
        <div className="operations-director-head">
          <div>
            <p className="eyebrow">Operations director</p>
            <h3>{operations.modeTitle}</h3>
          </div>
          <div className="operations-progress-badge">
            <strong>{operations.completionPercent}%</strong>
            <span>{operations.completedCount} / {operations.totalCount}</span>
          </div>
        </div>
        <span className="panel-minimize-indicator" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open ? (
        <>
          <p className="muted operations-summary">{operations.modeSummary}</p>

          <div className="operations-next-directive">
            <span>{lobbyMode === 'hub' ? 'Hub directive' : 'Private directive'}</span>
            <strong>{operations.nextDirective?.title || 'All primary directives complete'}</strong>
            <small>{operations.nextDirective?.detail || 'The base loop is online. Add new missions in future development passes.'}</small>
          </div>

          {validationSummary ? (
            <div className={`operations-validator-summary confidence-${validationSummary.confidence || 'low'}`}>
              <span>Symmetry validator</span>
              <strong>{String(validationSummary.confidence || 'low').toUpperCase()} confidence · {formatCoverage(validationSummary.coverage)} capture coverage</strong>
              <small>
                Checked {validationSummary.checked || 0} events · drift {validationSummary.driftCount || 0} · frame gaps {validationSummary.gapCount || 0}
                {validationSummary.strictCoverageFailed ? ' · strict coverage threshold failed' : ''}
              </small>
            </div>
          ) : null}

      {activeTab === 'overview' ? (
        <div className="operations-sections-grid">
          <Section title="Independent systems" kicker="Foundation" items={operations.independentSystems} />
          <Section title="Objectives" kicker="Live gameplay" items={operations.objectives} />
          <Section title="Mission chain" kicker="Progression" items={operations.missions} />
        </div>
      ) : (
        <section className="mission-assignment-panel" role="tabpanel">
          <div className="mission-assignment-head">
            <strong>Mission assignment board</strong>
            <span>Configure crew for selective blackholes, entropic credit gathering, and extended route work.</span>
          </div>
          <div className="mission-assignment-grid">
            <label>
              <span>Mission target</span>
              <select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
                {MISSION_TARGETS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Mission profile</span>
              <select value={missionType} onChange={(event) => setMissionType(event.target.value)}>
                {MISSION_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mission-assignment-grid crew-grid">
            <label>
              <span>Pilots assigned: {pilotCount}</span>
              <input type="range" min="1" max="8" step="1" value={pilotCount} onChange={(event) => setPilotCount(Number(event.target.value))} />
            </label>
            <label>
              <span>Space engineers assigned: {engineerCount}</span>
              <input type="range" min="0" max="6" step="1" value={engineerCount} onChange={(event) => setEngineerCount(Number(event.target.value))} />
            </label>
          </div>
          <div className="mission-assignment-summary">
            <small>Ready packet</small>
            <strong>{missionLabel}</strong>
            <p>{targetLabel} · {pilotCount} pilot{pilotCount === 1 ? '' : 's'} · {engineerCount} engineer{engineerCount === 1 ? '' : 's'} · total crew {totalCrew}</p>
          </div>
        </section>
      )}
          <div className="operations-sections-grid">
            <Section title="Independent systems" kicker="Foundation" items={operations.independentSystems} />
            <Section title="Objectives" kicker="Live gameplay" items={operations.objectives} />
            <Section title="Mission chain" kicker="Progression" items={operations.missions} />
          </div>
        </>
      ) : null}
    </div>
  );
}
