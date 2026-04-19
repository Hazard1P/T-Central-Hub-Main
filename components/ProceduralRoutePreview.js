export default function ProceduralRoutePreview({ title = "Route", accent = "#7dd3fc", detail = "Generated observance panel" }) {
  return (
    <div className="procedural-route-preview" aria-label={`${title} generated route visual`}>
      <div className="prp-stars" />
      <div className="prp-ring" style={{ borderColor: accent }} />
      <div className="prp-core" style={{ boxShadow: `0 0 48px ${accent}` }} />
      <div className="prp-arc prp-arc-a" style={{ borderColor: accent }} />
      <div className="prp-arc prp-arc-b" style={{ borderColor: accent }} />
      <div className="prp-labels">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}
