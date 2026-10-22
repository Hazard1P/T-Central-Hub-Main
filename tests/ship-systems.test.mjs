import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceShipSystems,
  earthServiceLocation,
  SHIP_HEALTH,
  SHIP_SHIELD,
} from "../lib/shipSystems.js";
const earth = { position: [1000, 2000, 3000], radius: 100 };
const pilot = (fields = {}) => ({
  position: [1300, 2000, 3000],
  velocity: [0, 0, 0],
  health: 40,
  shield: 0,
  alive: true,
  lastDamage: 1000,
  lastShot: 0,
  ...fields,
});

test("Earth services require the physical surface-to-4.2-radius shell and low speed", () => {
  assert(earthServiceLocation(pilot(), earth).atEarth);
  for (const offset of [99, 421])
    assert.equal(
      earthServiceLocation(
        pilot({ position: [1000 + offset, 2000, 3000] }),
        earth,
      ).atEarth,
      false,
    );
  for (const offset of [100, 420])
    assert.equal(
      earthServiceLocation(
        pilot({ position: [1000 + offset, 2000, 3000] }),
        earth,
      ).atEarth,
      true,
    );
  assert.equal(
    earthServiceLocation(pilot({ velocity: [8.01, 0, 0] }), earth).slow,
    false,
  );
  assert.equal(
    earthServiceLocation(pilot({ velocity: [8, 0, 0] }), earth).slow,
    true,
  );
});
test("server recovery waits after damage or firing, then restores at fixed rates and caps", () => {
  const p = pilot();
  advanceShipSystems(p, earth, 5999, 0.05);
  assert.equal(p.health, 40);
  assert.equal(p.shield, 0);
  assert.equal(p.repairState, "combat-lock");
  advanceShipSystems(p, earth, 6000, 1);
  assert.equal(p.health, 48);
  assert.equal(p.shield, 6);
  assert.equal(p.repairState, "repairing");
  p.lastShot = 6500;
  advanceShipSystems(p, earth, 7000, 1);
  assert.equal(p.health, 48);
  assert.equal(p.shield, 6);
  assert.equal(p.shieldReadyAt, 11500);
  advanceShipSystems(p, earth, 11500, 20);
  assert.equal(p.health, SHIP_HEALTH);
  assert.equal(p.shield, SHIP_SHIELD);
  advanceShipSystems(p, earth, 11600, 0.05);
  assert.equal(p.repairState, "ready");
});
test("only shields recover away from Earth or while moving; disabled ships never recover", () => {
  for (const fields of [
    { position: [5000, 2000, 3000] },
    { velocity: [9, 0, 0] },
  ]) {
    const p = pilot(fields);
    advanceShipSystems(p, earth, 10000, 1);
    assert.equal(p.health, 40);
    assert.equal(p.shield, 6);
    assert(["out-of-range", "brake"].includes(p.repairState));
  }
  const p = pilot({ alive: false, health: 0 });
  advanceShipSystems(p, earth, 10000, 10);
  assert.equal(p.health, 0);
  assert.equal(p.shield, 0);
  assert.equal(p.repairState, "disabled");
});
