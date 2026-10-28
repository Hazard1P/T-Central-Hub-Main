"use client";
import { SHIP_HEALTH, SHIP_SHIELD } from "@/lib/shipSystems";

export function recoveryMessage(ship, now = Date.now()) {
  if (!ship?.alive) return "Ship disabled · awaiting respawn";
  if (ship.landedAt) return "Landed · Earth safe zone";
  if (ship.safeZone) return "Earth safe zone · weapons locked";
  if (ship.invulnerableUntil > now)
    return "Spawn shield · firing ends protection";
  if (ship.repairState === "repairing") return "Earth repairs · +8 hull/s";
  if (ship.health <= 25) return "Hull critical · return to Earth";
  const wait = Math.max(0, Math.ceil((ship.shieldReadyAt - now) / 1000));
  if (ship.shield < SHIP_SHIELD)
    return wait ? `Shield recovery in ${wait}s` : "Shield recharging · +6/s";
  if (ship.health < SHIP_HEALTH)
    return ship.repairState === "combat-lock"
      ? `Earth repairs in ${wait}s`
      : ship.repairState === "brake"
        ? "Brake below 8 u/s for repairs"
        : "Hull damaged · repairs at Earth";
  return "Systems ready";
}

export default function ShipSystemsReadout({ ship, detailed = false }) {
  if (!ship || !Number.isFinite(ship.health) || !Number.isFinite(ship.shield))
    return null;
  return (
    <div
      className={detailed ? "shipyard-systems" : "combat-status"}
      data-critical={ship.alive && ship.health <= 25 ? "true" : undefined}
      aria-label="Ship combat status"
    >
      <label>
        Shield{" "}
        <meter
          aria-label="Shield strength"
          min="0"
          max={SHIP_SHIELD}
          value={ship.shield}
        />{" "}
        <span>
          {Math.ceil(ship.shield)}/{SHIP_SHIELD}
        </span>
      </label>
      <label>
        Hull{" "}
        <meter
          aria-label="Hull integrity"
          min="0"
          max={SHIP_HEALTH}
          low="25"
          optimum={SHIP_HEALTH}
          value={ship.health}
        />{" "}
        <span>{Math.ceil(ship.health)}%</span>
      </label>
      <small>{recoveryMessage(ship)}</small>
      {detailed ? (
        <p className="exploration-help">
          Shields absorb hits before hull damage. Both recover after five
          seconds without firing or taking damage. Hull repairs are free at
          Earth: stay outside the surface, within 4.2 Earth radii, below 8 u/s.
          Earth’s safe zone blocks weapons and incoming player fire. Leave its boundary to engage in combat.
        </p>
      ) : (
        <small>
          {ship.kills || 0} kills · {ship.deaths || 0} losses
        </small>
      )}
    </div>
  );
}
