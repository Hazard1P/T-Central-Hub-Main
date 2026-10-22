export const MAX_MULTIPLAYER_PLAYERS = 128;
export const PLAYER_LEASE_MS = 30000;
export const MULTIPLAYER_POLL_MS = 250;
export function multiplayerCapacity(env = process.env) {
  const raw =
    env.MULTIPLAYER_MAX_PLAYERS ?? env.NEXT_PUBLIC_MULTIPLAYER_MAX_SLOTS;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1
    ? Math.min(value, MAX_MULTIPLAYER_PLAYERS)
    : MAX_MULTIPLAYER_PLAYERS;
}
export function allowsMemoryMultiplayer(env = process.env) {
  return (
    env.NODE_ENV !== "production" || env.MULTIPLAYER_ALLOW_IN_MEMORY === "true"
  );
}
export function roomPopulation(playerCount, capacity = multiplayerCapacity()) {
  return {
    playerCount,
    capacity,
    available: Math.max(0, capacity - playerCount),
    full: playerCount >= capacity,
  };
}
export function fleetVisibility(pilots, position, performanceMode = false) {
  const sorted = pilots
    .filter((p) => Array.isArray(p.position))
    .map((p) => ({
      pilot: p,
      distance: Math.hypot(...p.position.map((v, i) => v - position[i])),
    }))
    .filter((p) => p.distance < 20000)
    .sort((a, b) => a.distance - b.distance);
  const detail = performanceMode ? 8 : 24,
    labels = performanceMode ? 3 : 6;
  return {
    detailed: sorted
      .slice(0, detail)
      .map((p, i) => ({ ...p.pilot, showLabel: i < labels })),
    markers: sorted.slice(detail, MAX_MULTIPLAYER_PLAYERS).map((p) => p.pilot),
  };
}
