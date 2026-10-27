import {
  defaultProgressState,
  normalizeProgressState,
} from "../accountProgression.js";
export function verifiedProgressIdentity(auth) {
  if (
    !auth?.authenticated ||
    !["google", "steam"].includes(auth.provider) ||
    !auth.accountId
  )
    throw Object.assign(
      new Error(
        "Sign in to sync account progress. Guest training stays on this device.",
      ),
      { status: 401 },
    );
  return {
    id: `${auth.provider}:${auth.accountId}`,
    displayName: auth.displayName || "Pilot",
    kind: auth.provider,
    authenticated: true,
  };
}
export function mergeClientDiscoveries(current, input) {
  const trusted = normalizeProgressState(current || defaultProgressState());
  const visited = Array.isArray(input?.visitedNodes)
    ? input.visitedNodes
        .filter(
          (key) =>
            typeof key === "string" && /^[A-Za-z0-9:_-]{1,80}$/.test(key),
        )
        .slice(0, 128)
    : [];
  return {
    ...trusted,
    visitedNodes: [...new Set([...trusted.visitedNodes, ...visited])].slice(
      -128,
    ),
  };
}
