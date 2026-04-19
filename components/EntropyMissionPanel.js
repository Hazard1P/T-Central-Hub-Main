'use client';

export default function EntropyMissionPanel({
  lobbyMode = 'hub',
  activeNode = null,
  progress = {},
  operations = null,
  onMineEntropy,
  onResolveEntropy,
  onOpenExchange,
}) {
  if (!operations) return null;

  const economy = operations.economy || { entropyMined: 0, entropyResolved: 0, unresolvedEntropy: 0, credits: 0, currency: { shortLabel: 'E_s credits', symbol: 'E_s' } };
  const canMine = lobbyMode === 'hub' && activeNode?.key === 'entropic_node';
  const canResolve = activeNode?.key === 'matrixcoinexchange' && economy.unresolvedEntropy > 0;

  return (
    <div className="content-card stable-card entropy-mission-card stable-card-layer telemetry-layer">
      <p className="eyebrow">Mission flow</p>
      <h3>Private universe → shared hub → return</h3>
      <p className="muted">
        Start in your private universe, jump into the shared hub, mine the entropic node, then return through the blackhole route to settle your haul into stabilized scalar gains.
      </p>

      <div className="entropy-loop-grid">
        {operations.missionLoop.map((step, index) => (
          <article className={`entropy-step ${step.complete ? 'is-complete' : ''}`} key={step.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </article>
        ))}
        <p className="system-legal-note">E_s Credits are in-game units with no guaranteed real-world monetary value.</p>
      </div>

      <div className="entropy-economy-grid">
        <div className="entropy-economy-item">
          <span>Mined</span>
          <strong>{economy.entropyMined}</strong>
        </div>
        <div className="entropy-economy-item">
          <span>Carried</span>
          <strong>{economy.unresolvedEntropy}</strong>
        </div>
        <div className="entropy-economy-item">
          <span>Settled</span>
          <strong>{economy.entropyResolved}</strong>
        </div>
        <div className="entropy-economy-item">
          <span>{economy.currency?.shortLabel || 'E_s credits'}</span>
          <strong>{economy.credits.toFixed(2)}</strong>
        </div>
      </div>

      <div className="stable-chip-row alt">
        <span>{lobbyMode === 'hub' ? 'Shared hub active' : 'Private universe active'}</span>
        <span>{activeNode?.label || 'Deep Space Blackhole'}</span>
        <span>{progress.seedCount || 0} seeds</span>
        <span>{progress.routeTrips || 0} routes</span>
      </div>

      <div className="entropy-action-row">
        <button className={`stable-route-button compact ${canMine ? 'is-live' : ''}`} type="button" onClick={onMineEntropy} disabled={!canMine}>
          Mine node
        </button>
        <button className={`stable-route-button compact ${canResolve ? 'is-live' : ''}`} type="button" onClick={onResolveEntropy} disabled={!canResolve}>
          Settle gains
        </button>
        <button className="stable-route-button compact" type="button" onClick={onOpenExchange}>
          Open MatrixCoinExchange
        </button>
      </div>
    </div>
  );
}
