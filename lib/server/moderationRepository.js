import {
  ACCOUNT_KEY_PATTERN,
  UUID_PATTERN,
  normalizePlayerReport,
} from "../moderation.js";

const unavailable = () =>
  Object.assign(new Error("Moderation storage is temporarily unavailable."), {
    status: 503,
    code: "MODERATION_UNAVAILABLE",
  });
export function createModerationRepository(admin) {
  async function rpc(name, args) {
    if (!admin) throw unavailable();
    try {
      const { data, error } = await admin
        .rpc(name, args)
        .abortSignal(AbortSignal.timeout(5000));
      if (error || !data) throw unavailable();
      if (!data.ok)
        throw Object.assign(new Error(data.error), {
          status: data.status || 400,
          code: data.error,
        });
      return data;
    } catch (error) {
      if (error.status) throw error;
      throw unavailable();
    }
  }
  return {
    submit: (body, reporter, rateKey) =>
      rpc("moderation_submit_report", {
        p_report: normalizePlayerReport(body),
        p_reporter: reporter,
        p_rate_key: rateKey,
      }),
    overview: (query = "") =>
      rpc("moderation_overview", {
        p_query: String(query).trim().slice(0, 160),
      }),
    access: async (keys) => {
      const accounts = [
        ...new Set(keys.filter((key) => ACCOUNT_KEY_PATTERN.test(key))),
      ];
      if (!accounts.length) return { ok: true, bans: [] };
      try {
        return await rpc("moderation_access", { p_keys: accounts });
      } catch {
        return { ok: false, error: "MODERATION_UNAVAILABLE" };
      }
    },
    hideChat: (body, actor) => {
      if (
        typeof body?.messageId !== "string" ||
        !UUID_PATTERN.test(body.messageId) ||
        typeof body.reason !== "string" ||
        body.reason.trim().length < 5 ||
        body.reason.trim().length > 1000
      )
        throw Object.assign(
          new Error("Select a chat message and provide a reason."),
          { status: 400 },
        );
      return rpc("moderation_hide_chat", {
        p_actor: actor,
        p_message: body.messageId,
        p_reason: body.reason.trim(),
      });
    },
    act: (body, actor) => {
      if (
        !body ||
        !["review", "dismiss", "resolve", "temp_ban", "ban", "unban"].includes(
          body.action,
        ) ||
        typeof body.reason !== "string" ||
        body.reason.trim().length < 5 ||
        body.reason.trim().length > 1000 ||
        (body.targetKey &&
          (typeof body.targetKey !== "string" ||
            !ACCOUNT_KEY_PATTERN.test(body.targetKey))) ||
        (body.action === "temp_ban" &&
          (!Number.isInteger(body.hours) ||
            body.hours < 1 ||
            body.hours > 8760)) ||
        (body.reference &&
          (typeof body.reference !== "string" ||
            !/^TC-[A-Z0-9-]{1,64}$/.test(body.reference)))
      )
        throw Object.assign(
          new Error(
            "Choose a valid action, account, duration and reason (5–1000 characters).",
          ),
          { status: 400 },
        );
      return rpc("moderation_apply_action", {
        p_actor: actor,
        p_target: body?.targetKey || null,
        p_action: body?.action,
        p_hours: body?.hours ?? null,
        p_reason: typeof body?.reason === "string" ? body.reason.trim() : "",
        p_report: body?.reference || null,
      });
    },
  };
}
