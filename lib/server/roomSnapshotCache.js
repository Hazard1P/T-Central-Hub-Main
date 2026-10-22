// Coalesce identical room reads within one worker. Never cache credentials or
// admission decisions. Callers replace their own pilot with a fresh trusted row.
export function createRoomSnapshotCache({
  ttlMs = 100,
  maxEntries = 128,
  now = Date.now,
} = {}) {
  const entries = new Map();
  return {
    async read(key, loader) {
      const current = entries.get(key);
      if (current && current.until > now()) return current.promise;
      const entry = { until: Infinity };
      entry.promise = Promise.resolve()
        .then(loader)
        .then(
          (value) => {
            entry.until = now() + ttlMs;
            return value;
          },
          (error) => {
            if (entries.get(key) === entry) entries.delete(key);
            throw error;
          },
        );
      entries.set(key, entry);
      if (entries.size > maxEntries)
        entries.delete(entries.keys().next().value);
      return entry.promise;
    },
    invalidate(key) {
      entries.delete(key);
    },
  };
}
