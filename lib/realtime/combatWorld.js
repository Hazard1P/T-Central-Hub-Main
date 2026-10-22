import { randomBytes } from "node:crypto";
import {
  stepFrame,
  buildGravitySourcesFromSeed,
} from "../simCore/stepFrame.js";
import { getCruiseControl } from "../exploration.js";
import { getSolarSpawn, getFlightObstacles } from "../universeFlight.js";
import {
  normalizedAim,
  segmentSphereHit,
  PULSE_INTERVAL_MS,
  PULSE_SPEED,
  PULSE_LIFETIME_MS,
} from "../shipWeapons.js";
import {
  multiplayerCapacity,
  PLAYER_LEASE_MS,
  roomPopulation,
} from "../multiplayerCapacity.js";
export const TICK_MS = 50,
  SNAPSHOT_MS = 100,
  SHIP_HEALTH = 100,
  SHIP_SHIELD = 60,
  PULSE_DAMAGE = 20,
  RESPAWN_MS = 5000,
  SPAWN_PROTECTION_MS = 5000;
const token = () => "rt_" + randomBytes(24).toString("base64url");
const vector = (v) =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const withinSweep = (from, to, center, radius) => {
  for (let axis = 0; axis < 3; axis++)
    if (
      center[axis] + radius < Math.min(from[axis], to[axis]) ||
      center[axis] - radius > Math.max(from[axis], to[axis])
    )
      return false;
  return true;
};
export class CombatWorld {
  constructor({ capacity = multiplayerCapacity(), now = Date.now() } = {}) {
    this.capacity = Number.isFinite(capacity)
      ? Math.max(1, Math.min(128, Math.floor(capacity)))
      : 128;
    this.rooms = new Map();
    this.lastTick = now;
    this.tickIndex = 0;
    this.shotIndex = 0;
  }
  population(name) {
    const room = this.rooms.get(name);
    const population = roomPopulation(room?.players.size || 0, this.capacity);
    const serverPlayerCount = [...this.rooms.values()].reduce(
      (sum, r) => sum + r.players.size,
      0,
    );
    const available = Math.min(
      population.available,
      this.capacity - serverPlayerCount,
    );
    return {
      ...population,
      available,
      full: available === 0,
      serverPlayerCount,
    };
  }
  lobby(name) {
    return {
      ok: true,
      room: name,
      durable: false,
      transport: "websocket",
      tickRate: 20,
      snapshotRate: 10,
      population: this.population(name),
    };
  }
  join(name, identity, now = Date.now()) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name) || !identity?.id)
      return { ok: false, status: 400, error: "INVALID_IDENTITY" };
    this.prune(now);
    // An account owns one active flight across the service, including room switches.
    for (const [otherName, other] of this.rooms) {
      if (otherName === name || !other.players.has(identity.id)) continue;
      other.players.delete(identity.id);
      other.shots = other.shots.filter((shot) => shot.ownerId !== identity.id);
      if (!other.players.size) this.rooms.delete(otherName);
    }
    let room = this.rooms.get(name);
    const existing = room?.players.get(identity.id);
    if (
      !existing &&
      [...this.rooms.values()].reduce((sum, r) => sum + r.players.size, 0) >=
        this.capacity
    )
      return {
        ok: false,
        status: 409,
        error:
          room?.players.size >= this.capacity ? "ROOM_FULL" : "SERVER_FULL",
        population: this.population(name),
        retryAfter: 5,
      };
    if (!room) {
      room = {
        name,
        players: new Map(),
        shots: [],
        events: [],
        sources: buildGravitySourcesFromSeed(name),
      };
      this.rooms.set(name, room);
    }
    const player = existing || {
      id: identity.id,
      displayName: identity.displayName || "Pilot",
      identityKind: identity.identityKind || "guest",
      authenticated: Boolean(identity.authenticated),
      token: token(),
      position: getSolarSpawn(identity.id, now),
      velocity: [0, 0, 0],
      direction: [0, 0, 1],
      health: SHIP_HEALTH,
      shield: SHIP_SHIELD,
      alive: true,
      kills: 0,
      deaths: 0,
      frameIndex: 0,
      lastInputFrame: 0,
      control: [0, 0, 0],
      firing: false,
      lastInput: 0,
      lastShot: 0,
      lastDamage: 0,
      invulnerableUntil: now + SPAWN_PROTECTION_MS,
      respawnAt: 0,
      revision: 0,
    };
    player.updatedAt = now;
    room.players.set(player.id, player);
    return {
      ok: true,
      room: name,
      token: player.token,
      player: this.publicPlayer(player, name),
      population: this.population(name),
    };
  }
  find(name, id, credential) {
    const player = this.rooms.get(name)?.players.get(id);
    return player && player.token === credential ? player : null;
  }
  touch(name, id) {
    const player = this.rooms.get(name)?.players.get(id);
    if (player) player.updatedAt = Date.now();
  }
  disconnect(name, id, credential) {
    const room = this.rooms.get(name);
    if (!this.find(name, id, credential))
      return { ok: false, status: 401, error: "PLAYER_SESSION_INVALID" };
    room.players.delete(id);
    room.shots = room.shots.filter((s) => s.ownerId !== id);
    if (!room.players.size) this.rooms.delete(name);
    return { ok: true };
  }
  input(name, id, credential, message, now = Date.now()) {
    const p = this.find(name, id, credential);
    if (!p || !p.alive) return false;
    if (
      !Number.isSafeInteger(message.frameIndex) ||
      message.frameIndex < p.lastInputFrame ||
      message.frameIndex > p.lastInputFrame + 100000 ||
      !vector(message.controlVector) ||
      !normalizedAim(message.direction)
    )
      return false;
    p.control = message.controlVector.map((v) =>
      Math.max(-1.75, Math.min(1.75, v)),
    );
    p.direction = normalizedAim(message.direction);
    p.lastInputFrame = message.frameIndex;
    p.lastInput = now;
    p.updatedAt = now;
    return true;
  }
  requestFire(name, id, credential, direction, now = Date.now()) {
    const room = this.rooms.get(name),
      p = this.find(name, id, credential),
      aim = normalizedAim(direction);
    if (!room || !p || !p.alive || !aim)
      return { ok: false, status: 401, error: "SHIP_NOT_READY" };
    if (now - p.lastShot < PULSE_INTERVAL_MS)
      return { ok: false, status: 429, error: "WEAPON_COOLDOWN" };
    p.direction = aim;
    this.fire(room, p, now);
    return { ok: true };
  }
  fire(room, p, now) {
    if (now - p.lastShot < PULSE_INTERVAL_MS || room.shots.length >= 2048)
      return;
    p.lastShot = now;
    p.invulnerableUntil = Math.min(p.invulnerableUntil, now);
    const origin = p.position.map((v, i) => v + p.direction[i] * 4);
    room.shots.push({
      id: "pulse-" + ++this.shotIndex,
      ownerId: p.id,
      origin,
      position: origin,
      velocity: p.direction.map((v, i) => v * PULSE_SPEED + p.velocity[i]),
      direction: [...p.direction],
      createdAt: now,
    });
  }
  event(room, type, fields, now) {
    room.events = [
      ...room.events.slice(-31),
      { id: token(), type, ...fields, at: now },
    ];
  }
  damage(room, victim, shooter, now) {
    const absorbed = Math.min(victim.shield, PULSE_DAMAGE);
    victim.shield -= absorbed;
    victim.health = Math.max(0, victim.health - PULSE_DAMAGE + absorbed);
    victim.lastDamage = now;
    this.event(
      room,
      "hit",
      { targetId: victim.id, ownerId: shooter?.id, damage: PULSE_DAMAGE },
      now,
    );
    if (victim.health > 0) return;
    victim.alive = false;
    victim.deaths++;
    victim.velocity = [0, 0, 0];
    victim.firing = false;
    victim.respawnAt = now + RESPAWN_MS;
    victim.token = token();
    if (shooter) {
      shooter.kills++;
      shooter.score = shooter.kills;
    }
    this.event(
      room,
      "destroyed",
      { targetId: victim.id, ownerId: shooter?.id },
      now,
    );
  }
  step(now) {
    const obstacles = getFlightObstacles(now).filter(
      (b) => b.key !== "earth-mining-field",
    );
    for (const room of this.rooms.values()) {
      for (const p of room.players.values()) {
        if (!p.alive) {
          if (now >= p.respawnAt) {
            Object.assign(p, {
              alive: true,
              health: SHIP_HEALTH,
              shield: SHIP_SHIELD,
              position: getSolarSpawn(p.id, now),
              velocity: [0, 0, 0],
              control: [0, 0, 0],
              firing: false,
              frameIndex: 0,
              lastInputFrame: 0,
              invulnerableUntil: now + SPAWN_PROTECTION_MS,
              respawnAt: 0,
              revision: p.revision + 1,
            });
            this.event(room, "respawn", { targetId: p.id }, now);
          }
          continue;
        }
        const fresh = now - p.lastInput <= 250;
        const control = fresh
          ? p.control
          : getCruiseControl({
              position: p.position,
              velocity: p.velocity,
              target: p.position,
              braking: true,
            });
        const stepped = stepFrame({
          position: p.position,
          velocity: p.velocity,
          controlVector: control,
          dt: TICK_MS / 1000,
          gravitySources: room.sources,
          worldSeed: room.name,
        });
        p.position = stepped.position;
        p.velocity = stepped.velocity;
        p.frameIndex = p.lastInputFrame;
        if (now - p.lastDamage > 5000)
          p.shield = Math.min(SHIP_SHIELD, p.shield + (TICK_MS / 1000) * 6);
        p.firing = now - p.lastShot < 250;
      }
      room.shots = room.shots.filter((shot) => {
        if (now - shot.createdAt > PULSE_LIFETIME_MS) return false;
        const next = shot.origin.map(
          (v, i) => v + (shot.velocity[i] * (now - shot.createdAt)) / 1000,
        );
        const obstacleHits = obstacles
          .filter((b) =>
            withinSweep(
              shot.position,
              next,
              b.position,
              b.solidRadius || b.radius,
            ),
          )
          .map((b) =>
            segmentSphereHit(
              shot.position,
              next,
              b.position,
              b.solidRadius || b.radius,
            ),
          )
          .filter(Boolean);
        const hits = [...room.players.values()]
          .filter(
            (p) =>
              p.id !== shot.ownerId &&
              p.alive &&
              now >= p.invulnerableUntil &&
              withinSweep(shot.position, next, p.position, 3.2),
          )
          .map((p) => ({
            p,
            hit: segmentSphereHit(shot.position, next, p.position, 3.2),
          }))
          .filter((x) => x.hit)
          .sort(
            (a, b) =>
              distance(shot.position, a.hit) - distance(shot.position, b.hit),
          );
        const closestObstacle = obstacleHits.reduce(
          (closest, hit) => Math.min(closest, distance(shot.position, hit)),
          Infinity,
        );
        if (
          closestObstacle <=
            (hits.length ? distance(shot.position, hits[0].hit) : Infinity) &&
          Number.isFinite(closestObstacle)
        )
          return false;
        if (hits.length) {
          this.damage(room, hits[0].p, room.players.get(shot.ownerId), now);
          return false;
        }
        shot.position = next;
        return true;
      });
      room.events = room.events.filter((e) => now - e.at < 5000);
    }
  }
  tick(now = Date.now()) {
    let elapsed = Math.max(0, Math.min(250, now - this.lastTick));
    while (elapsed >= TICK_MS) {
      this.step(now - elapsed + TICK_MS);
      elapsed -= TICK_MS;
      this.tickIndex++;
    }
    this.lastTick = now - elapsed;
    this.prune(now);
  }
  prune(now) {
    for (const [name, room] of this.rooms) {
      for (const [id, p] of room.players)
        if (now - p.updatedAt > PLAYER_LEASE_MS) room.players.delete(id);
      if (!room.players.size) this.rooms.delete(name);
    }
  }
  publicPlayer(p, room) {
    return {
      id: p.id,
      displayName: p.displayName,
      identityKind: p.identityKind,
      authenticated: p.authenticated,
      position: p.position.map((v) => Number(v.toFixed(4))),
      velocity: p.velocity.map((v) => Number(v.toFixed(4))),
      direction: p.direction.map((v) => Number(v.toFixed(4))),
      speed: Math.hypot(...p.velocity),
      health: p.health,
      shield: p.shield,
      alive: p.alive,
      kills: p.kills,
      deaths: p.deaths,
      invulnerableUntil: p.invulnerableUntil,
      respawnAt: p.respawnAt,
      revision: p.revision,
      frameIndex: p.frameIndex,
      simulationSeed: room,
      updatedAt: new Date(p.updatedAt).toISOString(),
    };
  }
  state(name, id, credential, { compact = false } = {}) {
    const room = this.rooms.get(name),
      self = this.find(name, id, credential);
    if (!room || !self)
      return { ok: false, status: 401, error: "PLAYER_SESSION_INVALID" };
    const all = [...room.players.values()].sort(
      (a, b) =>
        distance(a.position, self.position) -
        distance(b.position, self.position),
    );
    const players = (
      compact
        ? [
            self,
            ...all
              .filter(
                (p) =>
                  p.id !== id && distance(p.position, self.position) < 20000,
              )
              .slice(0, 31),
          ]
        : all
    ).map((p) => {
      const player = this.publicPlayer(p, name);
      if (!compact || p.id === id) return player;
      const {
        displayName,
        identityKind,
        authenticated,
        simulationSeed,
        updatedAt,
        speed,
        ...pose
      } = player;
      return pose;
    });
    const shots = room.shots
      .filter((s) => distance(s.position, self.position) < 10000)
      .sort(
        (a, b) =>
          distance(a.position, self.position) -
          distance(b.position, self.position),
      )
      .slice(0, 48)
      .map((s) => ({
        id: s.id,
        ownerId: s.ownerId,
        position: s.position.map((v) => Number(v.toFixed(3))),
        velocity: s.velocity.map((v) => Number(v.toFixed(3))),
        direction: s.direction.map((v) => Number(v.toFixed(4))),
      }));
    return {
      ok: true,
      room: name,
      token: self.token,
      state: {
        authoritative: true,
        transport: "websocket",
        durable: false,
        room: name,
        tick: this.tickIndex,
        playerCount: room.players.size,
        population: this.population(name),
        selfId: id,
        players,
        projectiles: shots,
        events: room.events,
        tickRate: 20,
      },
    };
  }
}
