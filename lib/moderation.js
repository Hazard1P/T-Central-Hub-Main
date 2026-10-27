export const REPORT_REASONS = [
  "Cheating or unfair advantage",
  "Griefing or sabotage",
  "Harassment or abuse",
  "Bug or exploit misuse",
  "Impersonation or false identity",
  "Other rule violation",
];
export const UUID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const ACCOUNT_KEY_PATTERN =
  /^(google:[A-Za-z0-9_-]{1,160}|steam:[0-9]{17})$/;
export function moderationAdminKeys(value = "") {
  return String(value)
    .split(",")
    .map((key) => key.trim())
    .filter((key) => ACCOUNT_KEY_PATTERN.test(key));
}
export function isModerationAdmin(auth, configured) {
  return Boolean(
    auth?.authenticated &&
    moderationAdminKeys(configured).includes(
      `${auth.provider}:${auth.accountId}`,
    ),
  );
}
export function normalizePlayerReport(body) {
  const fields = {
    reportedPlayer: 160,
    server: 120,
    reason: 500,
    evidence: 5000,
  };
  const result = {};
  for (const [key, max] of Object.entries(fields)) {
    const value = body?.[key];
    if (typeof value !== "string" || !value.trim() || value.trim().length > max)
      throw Object.assign(
        new Error("Complete all report fields within their length limits."),
        { status: 400 },
      );
    result[key] = value.trim();
  }
  const target = body?.targetKey || null;
  if (
    target !== null &&
    (typeof target !== "string" || !ACCOUNT_KEY_PATTERN.test(target))
  )
    throw Object.assign(new Error("Invalid account identifier."), {
      status: 400,
    });
  const chatMessageId = body?.chatMessageId || null;
  if (
    chatMessageId &&
    (typeof chatMessageId !== "string" || !UUID_PATTERN.test(chatMessageId))
  )
    throw Object.assign(new Error("Invalid chat reference."), { status: 400 });
  return {
    ...result,
    targetKey: target,
    ...(chatMessageId ? { chatMessageId } : {}),
  };
}
export function banDenial(result, accountKey) {
  if (!result?.ok)
    return { ok: false, status: 503, error: "MODERATION_UNAVAILABLE" };
  const ban = result.bans?.find((item) => item.account_key === accountKey);
  return ban
    ? {
        ok: false,
        status: 403,
        error: "ACCOUNT_BANNED",
        reason: ban.reason,
        expiresAt: ban.expires_at,
      }
    : { ok: true };
}

// The deployment owner is a verified website identity, not a display name or a GitHub username.
// Reuse a legacy owner only when both the provider and account ID are explicitly configured.
export function configuredSiteOwner(env = {}) {
  const owner = String(
    env.SITE_OWNER_ACCOUNT ||
      (env.DYSON_ADMIN_PROVIDER && env.DYSON_ADMIN_ACCOUNT_ID
        ? `${env.DYSON_ADMIN_PROVIDER}:${env.DYSON_ADMIN_ACCOUNT_ID}`
        : ""),
  ).trim();
  return ACCOUNT_KEY_PATTERN.test(owner) ? owner : null;
}
export function configuredModerationAdmins(env = {}) {
  return [
    ...new Set(
      [
        configuredSiteOwner(env),
        ...moderationAdminKeys(env.MODERATION_ADMIN_ACCOUNTS),
      ].filter(Boolean),
    ),
  ];
}
