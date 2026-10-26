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
          <dt>Travel assist</dt>
          <dd>{telemetry.travelMode || "Precision"}</dd>
        </div>
        <div>
          <dt>Approach speed target</dt>
          <dd>
            {Math.round(telemetry.speedLimit || 20).toLocaleString("en-US")} u/s
          </dd>
        </div>
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
        Precision, Transit and Deep space assist blend as clearance changes.
        Acceleration eases near the speed target; approach braking slows the
        ship gradually. With automatic braking off, it coasts within that
        target. Press X or hold Brake to stop. Planetary gravity uses physical
        units.
      </p>
    </details>
  );
}
