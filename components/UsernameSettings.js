"use client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

import { useEffect, useRef, useState } from "react";
import { useSteamSession } from "@/components/SteamSessionProvider";
import { normalizeGamertag } from "@/lib/accountUsername";

export default function UsernameSettings({ ownerKey, provider }) {
  const [profile, setProfile] = useState(null),
    [username, setUsername] = useState("");
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const active = useRef(true);
  const { refresh } = useSteamSession();
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    fetch("/api/account/username", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error);
        return result;
      })
      .then((result) => {
        if (active.current && result.ownerKey === ownerKey) {
          setProfile(result);
          setUsername(
            result.custom || result.managedBySteam ? result.username : "",
          );
        }
      })
      .catch((issue) => {
        if (active.current && issue.name !== "AbortError")
          setError(
            issue.message || "Account username is temporarily unavailable.",
          );
      });
    return () => {
      active.current = false;
      controller.abort();
    };
  }, [ownerKey]);
  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    let normalized;
    try {
      normalized = normalizeGamertag(username);
    } catch (issue) {
      setError(issue.message);
      return;
    }
    setPending(true);
    try {
      const response = await fetchWithTimeout("/api/account/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: normalized }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.error || "Could not save your gamertag.");
      if (!active.current || result.ownerKey !== ownerKey) return;
      setProfile(result);
      setUsername(result.username);
      setMessage(
        "Gamertag saved. Your next flight and new community posts will use it.",
      );
      await refresh();
      window.dispatchEvent(new Event("steam-session-updated"));
    } catch (issue) {
      if (active.current) setError(issue.message);
    } finally {
      if (active.current) setPending(false);
    }
  }
  const available = profile?.nextChangeAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(profile.nextChangeAt))
    : null;
  return (
    <section className="username-card" aria-labelledby="username-heading">
      <p className="eyebrow">Your identity</p>
      <h2 id="username-heading">Account username</h2>
      {profile ? (
        <p>
          Your gamertag: <strong>{profile.username}</strong>
        </p>
      ) : (
        <p className="muted">
          {error
            ? "Username settings are unavailable right now."
            : "Loading your username…"}
        </p>
      )}
      {provider === "steam" ? (
        <p className="muted">
          Your username follows your verified Steam profile name. Update it on
          Steam, then sign in again to sync it here.
        </p>
      ) : (
        <>
          <p className="muted">
            Choose the gamertag shown in flight and on new community posts. Your
            first choice is available immediately; later changes are allowed
            once every 30 days.
          </p>
          <form onSubmit={save}>
            <label htmlFor="account-username">Google account gamertag</label>
            <input
              id="account-username"
              autoComplete="nickname"
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={24}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={!profile?.canChange || pending}
              aria-describedby="username-help username-availability"
              required
            />
            <p className="muted" id="username-help">
              3–24 letters, numbers, underscores or hyphens. Start with a letter
              or number. Google gamertags are unique, ignoring capitalization.
            </p>
            <p id="username-availability">
              {profile?.canChange
                ? "You can choose a gamertag now."
                : available
                  ? `Next change available ${available}.`
                  : "Checking availability…"}
            </p>
            <button
              className="button primary"
              disabled={!profile?.canChange || pending}
            >
              {pending ? "Saving…" : "Save gamertag"}
            </button>
          </form>
        </>
      )}
      {error ? (
        <p role="alert" className="username-error">
          {error}
        </p>
      ) : null}
      <p role="status">{message}</p>
    </section>
  );
}
