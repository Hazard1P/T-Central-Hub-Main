// Shared rules; only the authoritative game service advances these values.
export const SHIP_HEALTH = 100;
export const SHIP_SHIELD = 60;
export const RECOVERY_DELAY_MS = 5000;
export const SHIELD_RECHARGE_PER_SECOND = 6;
export const HULL_REPAIR_PER_SECOND = 8;

export function earthServiceLocation(player, earth) {
  const speed = Math.hypot(...player.velocity);
  const distance = Math.hypot(
    ...player.position.map((v, i) => v - earth.position[i]),
  );
  return {
    atEarth: distance >= earth.radius && distance <= earth.radius * 4.2,
    slow: speed <= 8,
    speed,
  };
}

export function advanceShipSystems(player, earth, now, seconds) {
  const location = earthServiceLocation(player, earth);
  const readyAt =
    Math.max(player.lastDamage || 0, player.lastShot || 0) + RECOVERY_DELAY_MS;
  player.shieldReadyAt = readyAt;
  player.repairState = !player.alive
    ? "disabled"
    : !location.atEarth
      ? "out-of-range"
      : !location.slow
        ? "brake"
        : now < readyAt
          ? "combat-lock"
          : player.health < SHIP_HEALTH
            ? "repairing"
            : "ready";
  if (!player.alive || now < readyAt) return;
  player.shield = Math.min(
    SHIP_SHIELD,
    player.shield + seconds * SHIELD_RECHARGE_PER_SECOND,
  );
  if (player.repairState === "repairing")
    player.health = Math.min(
      SHIP_HEALTH,
      player.health + seconds * HULL_REPAIR_PER_SECOND,
    );
}
