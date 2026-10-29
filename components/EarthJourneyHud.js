"use client";
export default function EarthJourneyHud({ journey }) {
  if (!journey.active) return null;
  return (
    <aside
      className="earth-journey-hud"
      aria-label="Earth exploration"
      data-mode={journey.walking ? "walk" : "ship"}
    >
      <div>
        <strong>
          {journey.walking ? "Exploring Earth" : "Earth approach"}
        </strong>
        <small>
          {journey.walking
            ? `${journey.latitude.toFixed(4)}°, ${journey.longitude.toFixed(4)}° · ship ${Math.round(journey.shipDistanceMetres)} m`
            : journey.help}
        </small>
      </div>
      <button
        onClick={(event) => {
          event.currentTarget.blur();
          void journey.act();
        }}
        disabled={!journey.canAct}
        aria-keyshortcuts="E"
      >
        {journey.pending
          ? "Please wait…"
          : journey.walking
            ? "Board ship"
            : "Land & walk"}
        <kbd aria-hidden="true">E</kbd>
      </button>
      {journey.error ? (
        <p role="status">{journey.error}</p>
      ) : journey.walking ? (
        <p>
          {journey.shipDistanceMetres > 30
            ? "Follow the ship marker to return within 30 m."
            : journey.help}
        </p>
      ) : null}
    </aside>
  );
}
