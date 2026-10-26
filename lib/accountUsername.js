export function normalizeGamertag(value) {
  if (typeof value !== "string")
    throw new Error("Use 3–24 letters, numbers, underscores or hyphens.");
  const username = value.normalize("NFKC").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/.test(username))
    throw new Error(
      "Use 3–24 letters, numbers, underscores or hyphens, starting with a letter or number.",
    );
  return username;
}
