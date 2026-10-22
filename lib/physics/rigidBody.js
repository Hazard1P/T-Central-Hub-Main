import { rk4Step, sampleField, vector } from "./mechanics.js";
// Extension API for physical debris/cargo. Force uses mass*u/s²; torque uses
// mass*u²/s² in the body's principal axes. Live pilot attitude remains mouse-led.
export function stepRigidBody(
  state,
  { dt, force = [0, 0, 0], torque = [0, 0, 0], sources = [] } = {},
) {
  const mass = state.mass ?? 1,
    radius = state.radius ?? 1;
  if (
    !Number.isFinite(dt) ||
    dt < 0 ||
    dt > 0.2 ||
    !Number.isFinite(mass) ||
    mass <= 0 ||
    !Number.isFinite(radius) ||
    radius <= 0
  )
    throw new RangeError(
      "Positive mass/radius and dt between 0 and 0.2 seconds required.",
    );
  const inertia = state.inertia || Array(3).fill(0.4 * mass * radius * radius);
  if (
    !Array.isArray(inertia) ||
    inertia.length !== 3 ||
    !inertia.every((v) => Number.isFinite(v) && v > 0)
  )
    throw new RangeError("Principal moments of inertia must be positive.");
  let position = vector(state.position),
    velocity = vector(state.velocity),
    omega = vector(state.angularVelocity),
    q = state.orientation || [0, 0, 0, 1];
  if (
    !Array.isArray(q) ||
    q.length !== 4 ||
    !q.every(Number.isFinite) ||
    Math.hypot(...q) < 1e-12
  )
    throw new TypeError("A finite, nonzero quaternion is required.");
  q = q.map((v) => v / Math.hypot(...q));
  force = vector(force);
  torque = vector(torque);
  const count = Math.max(1, Math.ceil(dt / (1 / 120))),
    h = dt / count;
  const angularAcceleration = (w) => {
    const momentum = w.map((v, i) => v * inertia[i]);
    const cross = [
      w[1] * momentum[2] - w[2] * momentum[1],
      w[2] * momentum[0] - w[0] * momentum[2],
      w[0] * momentum[1] - w[1] * momentum[0],
    ];
    return torque.map((v, i) => (v - cross[i]) / inertia[i]);
  };
  for (let i = 0; i < count; i++) {
    const next = rk4Step(position, velocity, h, (p) =>
      sampleField(p, sources).map((v, k) => v + force[k] / mass),
    );
    position = next.position;
    velocity = next.velocity;
    const add = (a, b, k) => a.map((v, j) => v + b[j] * k);
    const k1 = angularAcceleration(omega),
      k2 = angularAcceleration(add(omega, k1, h / 2)),
      k3 = angularAcceleration(add(omega, k2, h / 2)),
      k4 = angularAcceleration(add(omega, k3, h));
    const end = omega.map(
      (v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]),
    );
    const mean = omega.map((v, j) => (v + end[j]) / 2),
      angle = Math.hypot(...mean) * h,
      scale = angle > 1e-12 ? Math.sin(angle / 2) / Math.hypot(...mean) : h / 2;
    const [x, y, z] = mean.map((v) => v * scale),
      w = Math.cos(angle / 2),
      [qx, qy, qz, qw] = q;
    q = [
      qw * x + qx * w + qy * z - qz * y,
      qw * y - qx * z + qy * w + qz * x,
      qw * z + qx * y - qy * x + qz * w,
      qw * w - qx * x - qy * y - qz * z,
    ];
    const norm = Math.hypot(...q);
    q = q.map((v) => v / norm);
    omega = end;
  }
  return {
    ...state,
    mass,
    radius,
    position,
    velocity,
    angularVelocity: omega,
    orientation: q,
    inertia: [...inertia],
  };
}
