import { normalizeGamertag } from "../accountUsername.js";
import { defaultGoogleUsername } from "./usernameDefaults.js";

export function createAccountUsernameRepository(admin) {
  async function run(auth, requested = null) {
    if (
      !auth?.authenticated ||
      !["google", "steam"].includes(auth.provider) ||
      !auth.accountId
    )
      throw Object.assign(
        new Error("Sign in to manage your account username."),
        { status: 401 },
      );
    if (requested !== null && auth.provider !== "google")
      throw Object.assign(
        new Error("Your Steam profile controls your username."),
        { status: 403 },
      );
    const username = requested === null ? null : normalizeGamertag(requested);
    if (!admin)
      throw Object.assign(
        new Error("Account usernames are temporarily unavailable."),
        { status: 503 },
      );
    const result = await admin
      .rpc("account_username", {
        p_provider: auth.provider,
        p_account_id: auth.accountId,
        p_default:
          auth.provider === "steam"
            ? auth.steamUser?.personaname || null
            : defaultGoogleUsername(auth.accountId),
        p_username: username,
      })
      .abortSignal(AbortSignal.timeout(5000));
    if (result.error || !result.data)
      throw Object.assign(
        new Error("Account usernames are temporarily unavailable."),
        { status: 503 },
      );
    if (!result.data.ok) {
      const code = result.data.error;
      const message =
        code === "USERNAME_COOLDOWN"
          ? "You can change your gamertag once every 30 days."
          : code === "USERNAME_TAKEN"
            ? "That gamertag is already in use. Try another."
            : code === "STEAM_MANAGED"
              ? "Your Steam profile controls your username."
              : "This gamertag is not valid.";
      throw Object.assign(new Error(message), {
        status: code === "STEAM_MANAGED" ? 403 : 409,
        code,
        nextChangeAt: result.data.nextChangeAt,
      });
    }
    return result.data;
  }
  return {
    read: (auth) => run(auth),
    update: (auth, username) => run(auth, username),
  };
}
