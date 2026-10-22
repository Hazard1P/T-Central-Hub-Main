import { getEarthMiningField } from './universeFlight.js';
import { segmentSphereHit, normalizedAim } from './shipWeapons.js';

export const ORE_VALUE = 10;
export const MINING_RANGE = 180;
export const MINING_COOLDOWN = 700;
export const ASTEROID_RESPAWN_MS = 45000;
export const SHIP_UPGRADES = Object.freeze({
  cargo: { name: 'Cargo bay', description: '+15 ore capacity per level', costs: [120, 240, 480] },
  laser: { name: 'Mining laser', description: '+1 mining damage per level', costs: [150, 300, 600] },
});
export const shipStats = (wallet = {}) => ({ capacity: 20 + Number(wallet.cargo_level || 0) * 15, damage: 1 + Number(wallet.laser_level || 0) });
export function miningGeometry(utcMs = Date.now()) {
  const { earth, center } = getEarthMiningField(utcMs);
  const rocks = Array.from({ length: 24 }, (_, index) => {
    const angle = index * 2.399963, radius = index < 4 ? 60 + index * 24 : 190 + index * 11;
    const local = [Math.cos(angle) * radius, ((index % 5) - 2) * 32, Math.sin(angle) * radius];
    return { id: 'ore-' + index, index, seed: index + 101, label: 'Asteroid ' + String(index + 1).padStart(2, '0'), local, position: center.map((v, i) => v + local[i]), radius: 10 + index % 4 * 3, yield: 4 + index % 4, rotation: [index * 1.7, index * .7, index * .3] };
  });
  return { earth, center, rocks, destination: { key: 'earth-mining-field', label: 'Earth mining field', kind: 'mining field', position: center, radius: 500, approachRadius: 620, color: '#f4cc87', description: 'Approach an asteroid, brake, then fire or use Mine asteroid. Carry ore back to Earth to earn upgrade credits.' } };
}
export function economyLocation(player, utcMs = Date.now()) {
  const geometry = miningGeometry(utcMs), position = player.position;
  const speed = Math.hypot(...player.velocity);
  const distance = Math.hypot(...position.map((v, i) => v - geometry.earth.position[i]));
  return { ...geometry, atEarth: distance <= geometry.earth.radius * 4.2 && distance >= geometry.earth.radius, slow: speed <= 8, speed, nearest: geometry.rocks.reduce((best, rock) => {
    const distance = Math.hypot(...position.map((v, i) => v - rock.position[i])) - rock.radius;
    return !best || distance < best.distance ? { ...rock, distance } : best;
  }, null) };
}
export function miningTarget(player, { asteroid, direction } = {}, utcMs = Date.now()) {
  const { rocks } = miningGeometry(utcMs);
  if (Math.hypot(...player.velocity) > 25) throw new Error('Brake below 25 u/s before mining.');
  let rock;
  if (direction) {
    const aim = normalizedAim(direction);
    if (!aim) throw new Error('Invalid mining aim.');
    const end = player.position.map((v, i) => v + aim[i] * MINING_RANGE);
    rock = rocks.filter(entry => Math.hypot(...entry.position.map((v,i) => v-player.position[i])) <= entry.radius || segmentSphereHit(player.position, end, entry.position, entry.radius)).sort((a, b) => Math.hypot(...a.position.map((v, i) => v - player.position[i])) - Math.hypot(...b.position.map((v, i) => v - player.position[i])))[0];
  } else rock = rocks.find(entry => entry.id === asteroid);
  if (!rock || Math.hypot(...rock.position.map((v, i) => v - player.position[i])) - rock.radius > MINING_RANGE) throw new Error('Move within 180 u of an asteroid in the Earth mining field.');
  return rock;
}

export function newShipWallet() { return { credits: 0, cargo: 0, cargo_level: 0, laser_level: 0, delivered: 0, last_mine: 0, flight_token: '', room: '' }; }
export function applyShipAction(wallet, rocks, command, now = Date.now()) {
  const next = { ...wallet }, stats = shipStats(next);
  let receipt = { type: command.action };
  if (command.action === 'mine') {
    if (now - next.last_mine < MINING_COOLDOWN) throw new Error('Mining laser is cooling down.');
    if (next.cargo >= stats.capacity) throw new Error('Cargo hold full. Deliver your ore to Earth.');
    const id = command.asteroid, index = Number(id?.slice(4));
    if (!/^ore-\d+$/.test(id) || index < 0 || index >= 24) throw new Error('Unknown asteroid.');
    const rock = { ...(rocks[id] || { hp: 3, depleted_until: 0 }) };
    if (!rock.hp && rock.depleted_until > now) throw new Error('Asteroid depleted. Find another rock or wait for regeneration.');
    if (!rock.hp) rock.hp = 3;
    rock.hp = Math.max(0, rock.hp - stats.damage); next.last_mine = now;
    const ore = rock.hp ? 0 : Math.min(4 + index % 4, stats.capacity - next.cargo);
    if (!rock.hp) rock.depleted_until = now + ASTEROID_RESPAWN_MS;
    next.cargo += ore; rocks[id] = rock;
    receipt = { type: 'mine', asteroid: id, hp: rock.hp, ore };
  } else if (command.action === 'deliver') {
    if (!command.atEarth || !command.slow) throw new Error('Return to Earth and brake below 8 u/s to unload.');
    if (!next.cargo) throw new Error('Your cargo hold is empty.');
    receipt = { type: 'deliver', ore: next.cargo, credits: next.cargo * ORE_VALUE };
    next.credits += receipt.credits; next.delivered += next.cargo; next.cargo = 0;
  } else if (command.action === 'upgrade') {
    if (!command.atEarth || !command.slow) throw new Error('Return to Earth and brake below 8 u/s to upgrade.');
    const offer = SHIP_UPGRADES[command.upgrade], key = command.upgrade + '_level';
    if (!offer || next[key] !== command.expectedLevel) throw new Error('Upgrade selection changed. Refresh your shipyard.');
    const price = offer.costs[next[key]];
    if (!price) throw new Error('This upgrade is already at maximum level.');
    if (next.credits < price) throw new Error('Earn more credits by delivering ore to Earth.');
    next.credits -= price; next[key] += 1; receipt = { type: 'upgrade', upgrade: command.upgrade, level: next[key], credits: -price };
  } else throw new Error('Unknown ship action.');
  return { wallet: next, receipt };
}
