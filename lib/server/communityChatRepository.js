export function publicChatMessage(message) {
  return {
    id: message.id,
    displayName: message.displayName,
    provider: message.provider,
    body: message.body,
    createdAt: message.createdAt,
  };
}
export function createCommunityChatRepository(admin) {
  async function rpc(name, args = {}) {
    if (!admin)
      throw Object.assign(Error("Live chat storage is unavailable."), {
        status: 503,
      });
    try {
      const { data, error } = await admin
        .rpc(name, args)
        .abortSignal(AbortSignal.timeout(5000));
      if (error || !data) throw Error("Storage unavailable");
      if (!data.ok)
        throw Object.assign(Error(data.error), { status: data.status || 400 });
      return data;
    } catch (error) {
      if (error.status) throw error;
      throw Object.assign(Error("Live chat storage is unavailable."), {
        status: 503,
      });
    }
  }
  return {
    history: async () => {
      const data = await rpc("community_chat_history");
      return { ok: true, messages: data.messages.map(publicChatMessage) };
    },
    post: async (identity, body) => {
      if (
        !identity?.authenticated ||
        !["google", "steam"].includes(identity.identityKind)
      )
        throw Object.assign(
          Error("Sign in with Google or Steam to send messages."),
          { status: 401 },
        );
      if (typeof body !== "string" || !body.trim() || body.trim().length > 500)
        throw Object.assign(Error("Messages must contain 1–500 characters."), {
          status: 400,
        });
      const data = await rpc("community_chat_post", {
        p_author: identity.id,
        p_name: String(identity.displayName || "Pilot").slice(0, 160),
        p_body: body.trim(),
      });
      return { ok: true, message: publicChatMessage(data.message) };
    },
  };
}
