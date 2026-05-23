import { runContinuityDrill, REPORT_FILE } from '../lib/continuity/continuityDrillService.js';

try {
  const report = await runContinuityDrill();
  console.log(JSON.stringify({ ok: report.result === 'pass', reportFile: REPORT_FILE, report }, null, 2));
  process.exit(report.result === 'pass' ? 0 : 1);
} catch (error) {
  const message = error instanceof Error ? error.message : 'unknown_continuity_drill_error';
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
