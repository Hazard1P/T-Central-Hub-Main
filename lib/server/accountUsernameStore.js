import { getSupabaseAdmin } from "./supabaseAdmin";
import { createAccountUsernameRepository } from "./accountUsernameRepository.js";

export const accountUsernames = () =>
  createAccountUsernameRepository(getSupabaseAdmin());

// Public naming can degrade without signing out a verified account. Mutations
// fail closed when durable storage is unavailable; no client clock grants a rename.
export async function resolveAccountUsername(auth) {
  if (!auth.authenticated) return auth;
  try {
    const profile = await accountUsernames().read(auth);
    return {
      ...auth,
      displayName: profile.username,
      googleUser:
        auth.provider === "google"
          ? { ...auth.googleUser, gamertag: profile.username }
          : auth.googleUser,
      steamUser:
        auth.provider === "steam"
          ? { ...auth.steamUser, personaname: profile.username }
          : auth.steamUser,
    };
  } catch {
    return auth;
  }
}
