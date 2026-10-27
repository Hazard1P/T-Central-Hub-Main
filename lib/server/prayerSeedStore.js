import { privateSeedCipher } from "./privateSeedCipher.js";
import path from "node:path";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { createPrayerSeedRepository } from "./prayerSeedRepository.js";

let repository;
export function getPrayerSeedStore() {
  if (!repository) {
    const localAllowed =
      process.env.NODE_ENV !== "production" &&
      !["1", "true"].includes(process.env.VERCEL);
    repository = createPrayerSeedRepository({
      admin: getSupabaseAdmin(),
      cipher: privateSeedCipher,
      localPath: localAllowed
        ? path.join(
            process.env.PRAYER_SEED_DATA_DIR ||
              path.join(process.cwd(), "data"),
            "account-prayer-seeds.json",
          )
        : null,
    });
  }
  return repository;
}
