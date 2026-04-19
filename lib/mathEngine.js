import * as THREE from 'three';

export const EPSILON = 1e-6;
export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(edge1 - edge0, EPSILON), 0, 1);
  return t * t * (3 - 2 * t);
}

export function normalizeVectorSafe(vector, fallback = new THREE.Vector3(0, 0, 0)) {
  if (!vector || vector.lengthSq() < EPSILON) return fallback.clone();
  return vector.clone().normalize();
}

export function inverseSquareFalloff(distance, exponent = 2, softening = 0.0001) {
  return 1 / Math.pow(Math.max(distance * distance + softening, EPSILON), exponent * 0.5);
}

export function gaussian(x, sigma = 1) {
  const safeSigma = Math.max(Math.abs(sigma), EPSILON);
  return Math.exp(-(x * x) / (2 * safeSigma * safeSigma));
}

export function remap(value, inMin, inMax, outMin, outMax) {
  const t = clamp((value - inMin) / Math.max(inMax - inMin, EPSILON), 0, 1);
  return lerp(outMin, outMax, t);
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-Math.max(lambda, EPSILON) * dt));
}

export function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function vectorToArray(vector) {
  return [vector.x, vector.y, vector.z];
}

export function arrayToVector(value = [0, 0, 0]) {
  return new THREE.Vector3(value[0] || 0, value[1] || 0, value[2] || 0);
}

export function rk4IntegrateVector(position, velocity, dt, accelerationFn) {
  const p0 = position.clone();
  const v0 = velocity.clone();

  const a1 = accelerationFn(p0, v0, 0);
  const k1v = a1.clone().multiplyScalar(dt);
  const k1p = v0.clone().multiplyScalar(dt);

  const a2 = accelerationFn(p0.clone().addScaledVector(k1p, 0.5), v0.clone().addScaledVector(k1v, 0.5), dt * 0.5);
  const k2v = a2.clone().multiplyScalar(dt);
  const k2p = v0.clone().addScaledVector(k1v, 0.5).multiplyScalar(dt);

  const a3 = accelerationFn(p0.clone().addScaledVector(k2p, 0.5), v0.clone().addScaledVector(k2v, 0.5), dt * 0.5);
  const k3v = a3.clone().multiplyScalar(dt);
  const k3p = v0.clone().addScaledVector(k2v, 0.5).multiplyScalar(dt);

  const a4 = accelerationFn(p0.clone().add(k3p), v0.clone().add(k3v), dt);
  const k4v = a4.clone().multiplyScalar(dt);
  const k4p = v0.clone().add(k3v).multiplyScalar(dt);

  const nextPosition = p0.clone().add(k1p.clone().addScaledVector(k2p, 2).addScaledVector(k3p, 2).add(k4p).multiplyScalar(1 / 6));
  const nextVelocity = v0.clone().add(k1v.clone().addScaledVector(k2v, 2).addScaledVector(k3v, 2).add(k4v).multiplyScalar(1 / 6));

  return { position: nextPosition, velocity: nextVelocity };
}

export function project12DToColor(dimensions = []) {
  const a = dimensions[0] || 0;
  const b = dimensions[4] || 0;
  const c = dimensions[8] || 0;
  return new THREE.Color(
    clamp(0.45 + a * 0.4, 0.1, 1),
    clamp(0.45 + b * 0.4, 0.1, 1),
    clamp(0.55 + c * 0.35, 0.1, 1),
  );
}


export function rk4Integrate(state, dt, derivFn) {
  const addScaled = (source, delta, scale) => ({
    position: source.position.map((value, index) => value + delta.dPosition[index] * scale),
    velocity: source.velocity.map((value, index) => value + delta.dVelocity[index] * scale),
  });

  const combine = (base, k1, k2, k3, k4) => ({
    position: base.position.map((value, index) => value + (k1.dPosition[index] + 2 * k2.dPosition[index] + 2 * k3.dPosition[index] + k4.dPosition[index]) * dt / 6),
    velocity: base.velocity.map((value, index) => value + (k1.dVelocity[index] + 2 * k2.dVelocity[index] + 2 * k3.dVelocity[index] + k4.dVelocity[index]) * dt / 6),
  });

  const k1 = derivFn(state, 0);
  const k2 = derivFn(addScaled(state, k1, dt * 0.5), dt * 0.5);
  const k3 = derivFn(addScaled(state, k2, dt * 0.5), dt * 0.5);
  const k4 = derivFn(addScaled(state, k3, dt), dt);
  return combine(state, k1, k2, k3, k4);
}
