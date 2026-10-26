import { stepFrame } from "./simCore/stepFrame.js";
import { buildGravitySources } from "./gravityEngine.js";
import { FLIGHT_TUNING } from "./flightTuning.js";

function scaleVec(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function length(v) {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
}

function normalize(v) {
  const len = length(v) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function createShipState() {
  return {
    position: [0, 0.9, 14],
    velocity: [0, 0, 0],
    thrust: [0, 0, 0],
    speed: 0,
    warp: 0,
    stress: 0,
  };
}

export function computeShipControls(input, mode = "max") {
  const base = mode === "max" ? 13.5 : 8.5;
  const vertical = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const forward = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const lateral = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const vector = normalize([lateral, vertical * 0.72, forward]);
  const throttle = input.boost ? FLIGHT_TUNING.maxControl : 1;
  return scaleVec(vector, base * throttle);
}

export function stepShipState({
  state,
  dt,
  graph,
  input,
  mode = "max",
  utcMs = Date.now(),
}) {
  const thrust = computeShipControls(input, mode),
    scale = mode === "max" ? 13.5 : 8.5;
  const result = stepFrame({
    position: state.position,
    velocity: state.velocity,
    controlVector: thrust.map((v) => v / scale),
    gravitySources: buildGravitySources(graph),
    dt,
    utcMs,
  });
  const speed = length(result.velocity),
    stress =
      (result.nearest?.tidal || 0) * 0.45 +
      (result.horizon?.lensing || 0) * 0.8;
  return {
    ...state,
    ...result,
    thrust,
    speed,
    warp: Math.min(1, Math.max(0, speed / (mode === "max" ? 24 : 14))),
    stress,
  };
}
