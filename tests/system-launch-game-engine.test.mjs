import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const systemEntryClient = readFileSync(new URL('../components/SystemEntryClient.js', import.meta.url), 'utf8');
const stableWorld = readFileSync(new URL('../components/StableSystemWorld.js', import.meta.url), 'utf8');

test('system launch path initializes gameEngine when entering simulation', () => {
  assert.match(systemEntryClient, /import \{ gameEngine \} from '@\/lib\/gameEngine';/);
  assert.match(systemEntryClient, /launchPhase !== 'in_sim' \|\| typeof window === 'undefined'/);
  assert.match(systemEntryClient, /gameEngine\.init\(\)/);
});

test('StableSystemWorld listens for gameEngine HUD toggle events', () => {
  assert.match(stableWorld, /const \[hudVisible, setHudVisible\] = useState\(true\)/);
  assert.match(stableWorld, /window\.addEventListener\('hudToggle', handleHudToggle\)/);
  assert.match(stableWorld, /\{hudVisible \? <div className="stable-system-hud"/);
});
