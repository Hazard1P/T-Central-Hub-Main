import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createBoundPrayerSeed,
  createCyberIntelligence,
  getSeedOwner,
  PrayerSeedError,
} from "./prayerSeedRecords.js";

const unavailable = () =>
  new PrayerSeedError(
    "Account seed storage is unavailable. Please keep your words and retry.",
    503,
  );

// The development adapter uses one atomic, queued document. Production requires the service-role database.
export function createPrayerSeedRepository({
  admin = null,
  localPath = null,
  cipher = null,
} = {}) {
  const reveal = (row) => {
    try {
      return cipher ? cipher.reveal(row) : row;
    } catch {
      throw unavailable();
    }
  };
  const protect = (row) => {
    try {
      return cipher ? cipher.protect(row) : row;
    } catch {
      throw unavailable();
    }
  };
  let queue = Promise.resolve();
  const transaction = (operation) => {
    const result = queue.then(async () => {
      let document;
      try {
        document = JSON.parse(await readFile(localPath, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw unavailable();
        document = { profiles: [], seeds: [] };
      }
      const result = await operation(document);
      if (result.changed) {
        await mkdir(path.dirname(localPath), { recursive: true });
        const temporary = localPath + ".tmp";
        await writeFile(temporary, JSON.stringify(document), { mode: 0o600 });
        await rename(temporary, localPath);
      }
      return result.value;
    });
    queue = result.catch(() => {});
    return result;
  };

  async function load(auth) {
    const owner = getSeedOwner(auth);
    if (!admin && !localPath) throw unavailable();
    if (!admin)
      return transaction((document) => ({
        value: {
          intelligence:
            document.profiles.find((entry) => entry.account_key === owner) ||
            null,
          seeds: document.seeds
            .filter((entry) => entry.account_key === owner)
            .sort((a, b) => b.epoch_unix - a.epoch_unix)
            .slice(0, 144)
            .map(reveal),
          total: document.seeds.filter((entry) => entry.account_key === owner)
            .length,
          storage: "development-local",
        },
      }));
    const [profile, seeds] = await Promise.all([
      admin
        .from("account_cyber_intelligence")
        .select("*")
        .eq("account_key", owner)
        .maybeSingle(),
      admin
        .from("account_prayer_seeds")
        .select("*", { count: "exact" })
        .eq("account_key", owner)
        .order("created_at", { ascending: false })
        .limit(144),
    ]);
    if (profile.error || seeds.error) throw unavailable();
    return {
      intelligence: profile.data,
      seeds: (seeds.data || []).map(reveal),
      total: seeds.count || 0,
      storage: "supabase",
    };
  }

  async function save(auth, input, { now = Date.now(), legacy = false } = {}) {
    const owner = getSeedOwner(auth);
    if (!admin && !localPath) throw unavailable();
    if (!admin)
      return transaction((document) => {
        const existing = document.seeds.find(
          (entry) =>
            entry.account_key === owner && entry.request_id === input.requestId,
        );
        if (existing)
          return {
            value: {
              seed: reveal(existing),
              storage: "development-local",
              duplicate: true,
            },
          };
        const latest = document.seeds
          .filter((entry) => entry.account_key === owner)
          .sort((a, b) => b.epoch_unix - a.epoch_unix)[0];
        if (!legacy && latest && now - Date.parse(latest.created_at) < 5000)
          throw new PrayerSeedError(
            "Give your last seed a moment to settle, then try again.",
            429,
          );
        let profile = document.profiles.find(
          (entry) => entry.account_key === owner,
        );
        if (!profile) {
          profile = createCyberIntelligence(auth, now);
          document.profiles.push(profile);
        }
        const seed = createBoundPrayerSeed(auth, profile, input, now);
        const stored = protect(seed);
        document.seeds.push(stored);
        return {
          changed: true,
          value: {
            seed: reveal(stored),
            storage: "development-local",
            duplicate: false,
          },
        };
      });

    const existing = await admin
      .from("account_prayer_seeds")
      .select("*")
      .eq("account_key", owner)
      .eq("request_id", input.requestId)
      .maybeSingle();
    if (existing.error) throw unavailable();
    if (existing.data)
      return {
        seed: reveal(existing.data),
        storage: "supabase",
        duplicate: true,
      };
    // Provider + account_id links to the existing account system and preserves legacy Steam keys.
    const account = await admin.from("player_accounts").upsert(
      {
        account_key: auth.provider === "steam" ? String(auth.accountId) : owner,
        provider: auth.provider,
        account_id: String(auth.accountId),
        steam_id: auth.provider === "steam" ? String(auth.accountId) : null,
        display_name: auth.displayName || "Pilot",
      },
      { onConflict: "provider,account_id", ignoreDuplicates: true },
    );
    if (account.error) throw unavailable();
    const profileWrite = await admin
      .from("account_cyber_intelligence")
      .upsert(createCyberIntelligence(auth, now), {
        onConflict: "account_key",
        ignoreDuplicates: true,
      });
    if (profileWrite.error) throw unavailable();
    const profile = await admin
      .from("account_cyber_intelligence")
      .select("*")
      .eq("account_key", owner)
      .single();
    if (profile.error) throw unavailable();
    if (!legacy) {
      const latest = await admin
        .from("account_prayer_seeds")
        .select("created_at")
        .eq("account_key", owner)
        .order("created_at", { ascending: false })
        .limit(1);
      if (latest.error) throw unavailable();
      if (
        latest.data?.[0] &&
        now - Date.parse(latest.data[0].created_at) < 5000
      ) {
        // A concurrent retry may have completed since the first lookup.
        const retry = await admin
          .from("account_prayer_seeds")
          .select("*")
          .eq("account_key", owner)
          .eq("request_id", input.requestId)
          .maybeSingle();
        if (retry.error) throw unavailable();
        if (retry.data)
          return {
            seed: reveal(retry.data),
            storage: "supabase",
            duplicate: true,
          };
        throw new PrayerSeedError(
          "Give your last seed a moment to settle, then try again.",
          429,
        );
      }
    }
    const seed = createBoundPrayerSeed(auth, profile.data, input, now);
    const write = await admin
      .from("account_prayer_seeds")
      .upsert(protect(seed), {
        onConflict: "account_key,request_id",
        ignoreDuplicates: true,
      });
    if (write.error) throw unavailable();
    const saved = await admin
      .from("account_prayer_seeds")
      .select("*")
      .eq("account_key", owner)
      .eq("request_id", input.requestId)
      .single();
    if (saved.error) throw unavailable();
    return {
      seed: reveal(saved.data),
      storage: "supabase",
      duplicate: saved.data.id !== seed.id,
    };
  }
  return { load, save };
}
