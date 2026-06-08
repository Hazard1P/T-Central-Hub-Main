import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAccountSnapshot, defaultProgressState, isOlderProgressSnapshot } from '../lib/accountProgression.js';

test('progression persistence is guarded until account hydration completes', () => {
  const stableWorld = readFileSync(new URL('../components/StableSystemWorld.js', import.meta.url), 'utf8');

  assert.match(stableWorld, /const \[progressHydrated, setProgressHydrated\] = useState\(false\)/);
  assert.match(stableWorld, /setProgressHydrated\(false\)/);
  assert.match(stableWorld, /\.finally\(\(\) => \{\s*if \(!active\) return;\s*setHydratedProgressIdentityKey\(progressIdentityKey\);\s*setProgressHydrated\(true\);\s*\}\)/s);
  assert.match(stableWorld, /if \(!progressHydrated \|\| hydratedProgressIdentityKey !== progressIdentityKey\) return;/);
  assert.match(stableWorld, /body: JSON\.stringify\(\{ identity, progress, savedAt: snapshot\.savedAt \}\)/);
});

test('older progression snapshots are rejected by savedAt ordering', () => {
  const identity = { id: 'steam:123', displayName: 'Pilot', kind: 'steam', authenticated: true };
  const current = buildAccountSnapshot({
    identity,
    progress: { ...defaultProgressState(), visitedNodes: ['solar_system'] },
    savedAt: '2026-06-08T12:00:00.000Z',
  });
  const incomingOlderDefault = buildAccountSnapshot({
    identity,
    progress: defaultProgressState(),
    savedAt: '2026-06-08T11:59:59.000Z',
  });
  const incomingNewer = buildAccountSnapshot({
    identity,
    progress: defaultProgressState(),
    savedAt: '2026-06-08T12:00:01.000Z',
  });

  assert.equal(isOlderProgressSnapshot(incomingOlderDefault, current), true);
  assert.equal(isOlderProgressSnapshot(incomingNewer, current), false);
});
