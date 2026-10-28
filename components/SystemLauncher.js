"use client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSteamSession } from "./SteamSessionProvider";
import { FLIGHT_CONTROL_COPY } from "@/lib/siteContent";

export default function SystemLauncher({
  onEnter,
  enabled = true,
  errorMessage = "",
  onReset,
}) {
  const { steamUser, googleUser, loading, sessionError, refresh } =
    useSteamSession();
  const [lobby, setLobby] = useState(null),
    [config, setConfig] = useState(null);
  const [authMessage, setAuthMessage] = useState(""),
    [returnTo, setReturnTo] = useState("/system");
  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href),
      room = url.searchParams.get("room");
    setReturnTo("/system" + (room ? "?room=" + encodeURIComponent(room) : ""));
    const status =
      url.searchParams.get("google") || url.searchParams.get("steam");
    if (status)
      setAuthMessage(
        status === "linked"
          ? "Account connected. Ready for launch."
          : "Sign-in did not finish. Please try again.",
      );
    const roomName =
      room || process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || "tcentral-main";
    let active = true;
    const checkLobby = () =>
      fetchWithTimeout(
        "/api/multiplayer/lobby?room=" + encodeURIComponent(roomName),
        { cache: "no-store" },
        6000,
      )
        .then((r) => r.json())
        .then((data) => {
          if (active) setLobby(data);
        })
        .catch(() => {
          if (active) setLobby({ ok: false });
        });
    void checkLobby();
    const timer = window.setInterval(checkLobby, 10000);
    fetch("/api/auth/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch(() => {});
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled]);
  const user = steamUser || googleUser;
  return (
    <main className="system-launcher compact-launcher">
      <div className="system-launcher-shell">
        <nav className="launch-topbar" aria-label="Simulation navigation">
          <Link href="/" className="launch-brand">
            T / C
          </Link>
          <Link href="/">Back to hub</Link>
        </nav>
        <section className="launch-intro" aria-labelledby="launch-title">
          <p className="eyebrow">Welcome, pilot</p>
          <h1 id="launch-title">Space &amp; Time</h1>
          <p className="launch-description">
            Launch from Earth. Explore, land and fly together.
          </p>
          <p className="launch-facts">
            Real-time multiplayer · Earth landings · Mobile flight
          </p>
          <div className="entry-actions launch-actions">
            <button
              type="button"
              className="button primary"
              disabled={loading || Boolean(sessionError) || !lobby?.ok}
              onClick={() => onEnter?.({ mode: "hub" })}
            >
              {lobby?.population?.full
                ? "Wait for a pilot slot"
                : "Join shared flight"}{" "}
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => onEnter?.({ mode: "private" })}
            >
              Fly solo
            </button>
          </div>
          <p className="launch-caption" role="status">
            {loading
              ? "Checking your account…"
              : !lobby
                ? "Checking the shared universe…"
                : !lobby.ok
                  ? "Shared flight unavailable. You can fly solo."
                  : `${lobby.population.playerCount} / ${lobby.population.capacity} pilots · ${lobby.population.full ? "Waiting for a free slot" : "Ready for launch"}`}
          </p>
        </section>
        {errorMessage ? (
          <div className="launch-error" role="alert">
            <p>{errorMessage}</p>
            <button className="button secondary" onClick={onReset}>
              Reset launcher
            </button>
          </div>
        ) : null}
        <section className="launch-account" aria-label="Pilot account">
          <p>
            <strong>
              {loading
                ? "Checking session…"
                : user
                  ? steamUser?.personaname || googleUser?.gamertag || "Pilot"
                  : "Guest pilot"}
            </strong>
            <span>
              {user
                ? `Connected with ${steamUser ? "Steam" : "Google"}`
                : "Sign in to save account progress."}
            </span>
          </p>
          {sessionError ? (
            <p role="alert">
              {sessionError}{" "}
              <button onClick={refresh} type="button">
                Retry
              </button>
            </p>
          ) : null}
          {authMessage ? <p role="status">{authMessage}</p> : null}
          <div className="launch-account-actions">
            {user ? (
              <>
                <Link className="button secondary" href="/profile">
                  View account
                </Link>
                <a href={`/api/auth/${steamUser ? "steam" : "google"}/logout`}>
                  Sign out
                </a>
              </>
            ) : (
              <>
                {config?.steam ? (
                  <a
                    className="button secondary"
                    href={
                      "/api/auth/steam/login?redirectTo=" +
                      encodeURIComponent(returnTo)
                    }
                  >
                    Steam sign-in
                  </a>
                ) : null}
                {config?.google ? (
                  <a
                    className="button secondary"
                    href={
                      "/api/auth/google/login?redirectTo=" +
                      encodeURIComponent(returnTo)
                    }
                  >
                    Google sign-in
                  </a>
                ) : null}
                {config && !config.steam && !config.google ? (
                  <span className="launch-caption">
                    Account sign-in is being configured.
                  </span>
                ) : null}
              </>
            )}
          </div>
        </section>
        <details className="launch-briefing">
          <summary>Flight controls &amp; goals</summary>
          <div>
            <p>{FLIGHT_CONTROL_COPY.launchPrimer}</p>
            <p>
              Explore sets waypoints. Cruise handles the approach. Descend to an
              Earth spaceport to land, then use Take off or E to fly again.
            </p>
            <p>
              Mine nearby asteroids, deliver ore at Earth, and upgrade in
              Shipyard.
            </p>
          </div>
        </details>
        <p className="launch-legal">
          19+ community · <Link href="/terms-and-conditions">Terms</Link> ·{" "}
          <Link href="/privacy-policy">Privacy</Link>
        </p>
      </div>
    </main>
  );
}
