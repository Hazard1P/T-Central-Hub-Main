'use client';

const DEFAULT_REASONS = [
  'Cheating or unfair advantage',
  'Griefing or sabotage',
  'Harassment or abuse',
  'Bug or exploit misuse',
  'Impersonation or false identity',
  'Other rule violation',
];

const DEFAULT_COLUMNS = [
  'Reported player',
  'Server or location',
  'Reason',
  'Evidence or notes',
];

export default function ModerationQueuePanel({ summary = null }) {
  const reasons = Array.isArray(summary?.allowedReasons) && summary.allowedReasons.length
    ? summary.allowedReasons
    : DEFAULT_REASONS;
  const columns = Array.isArray(summary?.reportColumns) && summary.reportColumns.length
    ? summary.reportColumns
    : DEFAULT_COLUMNS;

  return (
    <section className="report-moderation-panel">
      <div className="report-header compact">
        <p className="report-kicker">Reporting guide</p>
        <h2>How to file a player report</h2>
        <p className="report-copy">
          Submit the player name, where it happened, the reason for the report, and any useful evidence or notes.
        </p>
      </div>

      <div className="report-public-grid">
        <div>
          <span>Reasons</span>
          <ul>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <div>
          <span>Report fields</span>
          <ul>
            {columns.map((column) => (
              <li key={column}>{column}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
