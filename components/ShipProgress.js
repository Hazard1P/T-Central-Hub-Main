"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
export default function ShipProgress({ ownerKey }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/game/profile", { cache: "no-store" }),
        body = await response.json();
      if (!response.ok || !body.ok || body.ownerKey !== ownerKey)
        throw Error(body.error || "Your account changed. Refresh the page.");
      setData(body);
      setError("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [ownerKey]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const ship = data?.ownerKey === ownerKey ? data.ship : null;
  return (
    <section className="content-card" aria-labelledby="ship-progress-title">
      <p className="eyebrow">Your saved flight progress</p>
      <h2 id="ship-progress-title">Your ship</h2>
      <p>
        Earn game credits by delivering ore to Earth. Your credits and installed
        upgrades follow this account across flights.
      </p>
      {error ? <p role="status">{error}</p> : null}
      {ship ? (
        <div className="contribution-totals">
          <article>
            <h3>Game credits</h3>
            <strong>{ship.credits}</strong>
            <p>{ship.delivered} ore delivered</p>
          </article>
          <article>
            <h3>Cargo bay · {ship.cargo_level}/3</h3>
            <p>{ship.stats.capacity} ore capacity</p>
          </article>
          <article>
            <h3>Mining laser · {ship.laser_level}/3</h3>
            <p>{ship.stats.damage} damage per hit</p>
          </article>
        </div>
      ) : null}
      <div className="entry-actions">
        <button
          className="button secondary"
          disabled={loading}
          onClick={refresh}
        >
          {loading ? "Checking ship…" : "Refresh ship progress"}
        </button>
        <Link className="button primary" href="/system">
          Join a shared flight
        </Link>
      </div>
      <p className="muted">
        Carried ore belongs to the current flight and is discarded on a fresh
        session. Game credits have no cash value and are separate from
        contributions and undefined VIP plans.
      </p>
    </section>
  );
}
