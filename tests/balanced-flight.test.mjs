import test from "node:test";
import { solarBodyPosition } from "../lib/solarSystem.js";
import assert from "node:assert/strict";
import {
  FLIGHT_TUNING,
  flightEnvelope,
  governedThrust,
} from "../lib/flightTuning.js";
import {
  SOLAR_WORLD_CENTER,
  SOLAR_UNITS_PER_AU,
  WORLD_LIMIT,
  MAX_FLIGHT_SPEED,
  UNIVERSE_LANDMARKS,
  contractDeepSpacePosition,
} from "../lib/universeSpace.js";
import {
  COSMIC_POSITIONS,
  PERIMETER_POSITIONS,
  spreadCosmicNode,
} from "../lib/cosmicLayout.js";
import { DOCK_OFFSET, DYSON_OUTER_RADIUS } from "../lib/celestialScale.js";
import {
  getUniverseSolarState,
  getSolarSpawn,
  getFlightEnvironment,
} from "../lib/universeFlight.js";
import {
  stepFrame,
  buildGravitySourcesFromSeed,
} from "../lib/simCore/stepFrame.js";
import {
  getCruiseControl,
  distanceBetween,
  getApproachPoint,
} from "../lib/exploration.js";
import { miningGeometry, miningTarget } from "../lib/shipEconomy.js";
const epoch = Date.UTC(2026, 9, 26),
  near = (a, b, tolerance = 1e-6) =>
    assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("outer anchors contract by 20 percent around the Sun, preserving full-size docking clearance", () => {
  const cases = [
    ["ss", [-156e6, 44e6, 124e6]],
    ["ember_star", [-136e6, 112e6, 12e6]],
  ];
  for (const [key, old] of cases)
    near(
      distanceBetween(COSMIC_POSITIONS[key], SOLAR_WORLD_CENTER) /
        distanceBetween(old, SOLAR_WORLD_CENTER),
      0.8,
    );
  assert.deepEqual(
    PERIMETER_POSITIONS[0],
    contractDeepSpacePosition([264e6, 108e6, 224e6]),
  );
  assert.deepEqual(
    UNIVERSE_LANDMARKS[0].position,
    contractDeepSpacePosition([190e6, 30e6, 96e6]),
  );
  assert.deepEqual(
    COSMIC_POSITIONS.ss_dock.map((v, i) => v - COSMIC_POSITIONS.ss[i]),
    DOCK_OFFSET,
  );
  assert(
    distanceBetween(COSMIC_POSITIONS.ss_dock, COSMIC_POSITIONS.ss) >
      DYSON_OUTER_RADIUS,
  );
  const relay = spreadCosmicNode({ key: "aux-1-2" });
  assert(relay.position.every((v) => Math.abs(v) < WORLD_LIMIT));
  assert.equal(WORLD_LIMIT, 800_000_000);
});

test("the large physical Solar System and Earth spawn keep their original AU conversion", () => {
  assert.equal(SOLAR_UNITS_PER_AU, 4_000_000);
  const earth = getUniverseSolarState(epoch).find((b) => b.id === "earth");
  assert(earth.radius > 170 && earth.radius < 171);
  near(
    distanceBetween(earth.position, SOLAR_WORLD_CENTER) / SOLAR_UNITS_PER_AU,
    Math.hypot(...solarBodyPosition("earth", epoch)),
  );
  const spawn = getSolarSpawn("balanced", epoch);
  assert(distanceBetween(spawn, earth.position) > earth.radius * 3.2);
  assert(distanceBetween(spawn, earth.position) < earth.radius * 3.5);
});

test("travel targets rise continuously with clearance and remain bounded at local and deep-space speeds", () => {
  for (const physical of [false, true]) {
    let previous = 0;
    for (const distance of [
      0,
      59.999,
      60,
      60.001,
      159.999,
      160,
      160.001,
      340,
      341,
      1000,
      10000,
      1e6,
      1e8,
      Infinity,
    ]) {
      const current = flightEnvelope(distance, 170, physical);
      assert(current.speedLimit >= previous);
      assert(current.speedLimit <= MAX_FLIGHT_SPEED);
      previous = current.speedLimit;
    }
    near(
      flightEnvelope(60 - 1e-6, 0, physical).speedLimit,
      flightEnvelope(60 + 1e-6, 0, physical).speedLimit,
      0.001,
    );
  }
  assert.equal(flightEnvelope(0).mode, "Precision");
  assert.equal(flightEnvelope(1000).mode, "Transit");
  assert.equal(flightEnvelope(1e8).mode, "Deep space");
});

test("the governor eases thrust near its target and preserves inertial coasting below it", () => {
  const plain = governedThrust([0, 0, 0], [12, 0, 0], 20, 12);
  const eased = governedThrust([19.9, 0, 0], [12, 0, 0], 20, 12);
  assert(eased[0] > 0 && eased[0] < plain[0] * 0.1);
  assert.deepEqual(governedThrust([10, 0, 0], [0, 0, 0], 20, 12), [0, 0, 0]);
  const brake = governedThrust([1000, 0, 0], [-21, 0, 0], 20, 12);
  assert(
    brake[0] < -1000,
    "brake authority must not collapse to local manoeuvring thrust",
  );
  assert(
    Math.abs(brake[0]) <=
      FLIGHT_TUNING.thrust * FLIGHT_TUNING.maxAssist * FLIGHT_TUNING.maxControl,
  );
});

const precisionFrame = {
  utcMs: epoch,
  sources: [],
  bodies: [],
  obstacles: [{ key: "precision-region", position: [0, 0, 0], radius: 500 }],
};
test("entering a slower region decelerates over time instead of clipping velocity or displacement", () => {
  let state = { position: [0, 0, 0], velocity: [0, 100, 0] };
  const next = stepFrame({
    ...state,
    controlVector: [0, 0, 0],
    dt: 0.05,
    physicsFrame: precisionFrame,
  });
  assert(next.velocity[1] < 100 && next.velocity[1] > 80);
  assert(
    next.position[1] > 4,
    "the first segment must retain its actual integrated momentum",
  );
  state = next;
  for (let i = 0; i < 80; i++)
    state = stepFrame({
      ...state,
      controlVector: [0, 0, 0],
      dt: 0.05,
      physicsFrame: precisionFrame,
    });
  assert(state.velocity[1] > 19 && state.velocity[1] < 21);
  const coast = stepFrame({
    position: [0, 0, 0],
    velocity: [0, 10, 0],
    controlVector: [0, 0, 0],
    dt: 0.2,
    physicsFrame: precisionFrame,
  });
  assert.deepEqual(coast.velocity, [0, 10, 0]);
});

test("the balanced governor produces comparable motion at different simulation frame rates", () => {
  const integrate = (dt) => {
    let state = { position: [0, 0, 0], velocity: [19.5, 0, 0] };
    for (let i = 0; i < Math.round(2 / dt); i++)
      state = stepFrame({
        ...state,
        controlVector: [1, 0, 0],
        dt,
        physicsFrame: precisionFrame,
      });
    return state;
  };
  const a = integrate(1 / 30),
    b = integrate(1 / 120);
  near(a.position[0], b.position[0], 1e-5);
  near(a.velocity[0], b.velocity[0], 1e-5);
});

test("cruise reaches a moving mine at mining speed without passing through its approach point", () => {
  let state = {
    position: getSolarSpawn("balanced-mine", epoch),
    velocity: [0, 0, 0],
    gravity: [0, 0, 0],
  };
  const sources = buildGravitySourcesFromSeed("balanced-mine");
  let arrived = false;
  for (let i = 0; i < 1200; i++) {
    const utcMs = epoch + i * 50,
      rock = miningGeometry(utcMs).rocks[0];
    const target = getApproachPoint(state.position, {
      ...rock,
      approachRadius: rock.radius + 35,
    });
    state = stepFrame({
      ...state,
      controlVector: getCruiseControl({ ...state, target, utcMs }),
      dt: 0.05,
      utcMs,
      gravitySources: sources,
    });
    if (
      distanceBetween(state.position, target) < 5 &&
      Math.hypot(...state.velocity) < 8
    ) {
      assert.equal(
        miningTarget(state, { asteroid: rock.id }, utcMs).id,
        rock.id,
      );
      arrived = true;
      break;
    }
  }
  assert(arrived, "moving asteroid approach should settle within a minute");
});

test("crossing the nearest-reference boundary does not jump travel speed or acceleration", () => {
  const obstacles = [
    { id: "earth", position: [0, 0, 0], radius: 100 },
    { key: "mining", position: [1000, 0, 0], radius: 100 },
  ];
  const a = getFlightEnvironment([499.999, 0, 0], epoch, [], obstacles);
  const b = getFlightEnvironment([500.001, 0, 0], epoch, [], obstacles);
  near(a.scale, b.scale, 0.001);
  near(a.speedLimit, b.speedLimit, 0.01);
});
