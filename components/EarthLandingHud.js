"use client";
export default function EarthLandingHud({ landing, onApproach }) {
  if (!landing.active && !landing.landedAt) return null;
  const grounded = Boolean(landing.landedAt);
  return (
    <aside
      className="earth-landing-hud"
      aria-label="Earth surface and landing"
      data-mode={grounded ? "landed" : "surface"}
    >
      <div>
        <strong>{grounded ? landing.pad?.name : "Earth surface"}</strong>
        <small>
          {grounded
            ? "Landed · protected spaceport"
            : `${Math.max(0, landing.altitude).toFixed(0)} u altitude · ${landing.pad?.name || "No free pad"}`}
        </small>
      </div>
      <div className="earth-landing-actions">
        {!grounded && landing.pad ? (
          <button
            onClick={() => onApproach(landing.pad.siteId)}
            disabled={landing.pending}
          >
            Approach
          </button>
        ) : null}
        <button
          onClick={landing.act}
          aria-keyshortcuts="E"
          disabled={landing.pending || (!grounded && !landing.canLand)}
        >
          {landing.pending ? "Please wait…" : grounded ? "Take off" : "Land"}
          <kbd aria-hidden="true">E</kbd>
        </button>
      </div>
      {landing.error ? (
        <p role="status">{landing.error}</p>
      ) : !grounded ? (
        <p>
          {landing.canLand
            ? "Pad in range · ready to land"
            : !landing.nearest
              ? "All landing pads are occupied. Explore or wait for a berth."
              : landing.nearest.distance > 32
                ? `Approach a free pad · ${Math.ceil(landing.nearest.distance)} u away`
                : "Brake below 8 u/s to land"}
        </p>
      ) : (
        <p>Use Take off to fly over the terrain or return to space.</p>
      )}
    </aside>
  );
}
