import { getSupabaseAdmin } from "./supabaseAdmin";
import { createModerationRepository } from "./moderationRepository";
export const moderation = () => createModerationRepository(getSupabaseAdmin());
