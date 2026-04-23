'use client';

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

export default function OperationsDirectorPanel({ operations, lobbyMode = 'hub', validationSummary = null }) {
  if (!operations) return null;

  return (
    <div className="content-card stable-card operations-director-card stable-card-layer systems-layer">
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

      <div className="operations-sections-grid">
        <Section title="Independent systems" kicker="Foundation" items={operations.independentSystems} />
        <Section title="Objectives" kicker="Live gameplay" items={operations.objectives} />
        <Section title="Mission chain" kicker="Progression" items={operations.missions} />
      </div>
    </div>
  );
}
