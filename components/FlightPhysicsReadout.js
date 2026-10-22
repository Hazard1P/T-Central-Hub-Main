"use client";
import { KM_PER_UNIT } from "@/lib/physics/mechanics";
export default function FlightPhysicsReadout({ telemetry }) {
  if (!telemetry.physics) return null;
  const gravity = telemetry.gravityAcceleration ?? telemetry.gravity;
  return (
    <details className="flight-physics-readout">
      <summary>Flight physics</summary>
      <dl>
        <div>
          <dt>Gravity</dt>
          <dd>{(gravity * KM_PER_UNIT * 1000).toPrecision(3)} m/s²</dd>
        </div>
        <div>
          <dt>Gravity reference</dt>
          <dd>
            {telemetry.nearest?.replace(/^solar-/, "").replaceAll("_", " ") ||
              "Open space"}
          </dd>
        </div>
        <div>
          <dt>Body escape speed</dt>
          <dd>
            {(telemetry.escapeVelocity * KM_PER_UNIT).toPrecision(3)} km/s
          </dd>
        </div>
      </dl>
      <p className="exploration-help">
        With automatic braking off, your ship coasts without vacuum drag. Press
        X or use Brake to slow down. Planetary gravity uses physical units;
        deep-space thrust and speed limits remain assisted for travel.
      </p>
    </details>
  );
}
