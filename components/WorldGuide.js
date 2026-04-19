'use client';

export default function WorldGuide() {
  return (
    <div className="world-guide">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">World guide</span>
        <strong>How to use the system</strong>
      </div>

      <div className="world-guide-list">
        <div className="world-guide-item">
          <span>1</span>
          <p>Select a node or move toward a blackhole to reveal its route.</p>
        </div>
        <div className="world-guide-item">
          <span>2</span>
          <p>Enter pilot mode to fly directly, or stay in spectate mode to observe the room.</p>
        </div>
        <div className="world-guide-item">
          <span>3</span>
          <p>Use the Arma3 blackhole to open the tactical interior and connect to the live server.</p>
        </div>
      </div>
    </div>
  );
}
