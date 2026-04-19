'use client';

export default function ProgressStagePanel() {
  return (
    <div className="progress-stage-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Next stage</span>
        <strong>Stabilized progression</strong>
      </div>
      <div className="progress-stage-list">
        <div className="progress-stage-item">
          <span>1</span>
          <p>Player runtime now starts from a safe default state before the live scene updates it.</p>
        </div>
        <div className="progress-stage-item">
          <span>2</span>
          <p>The 3D world continues forward while guarding position-based logic against undefined state.</p>
        </div>
        <div className="progress-stage-item">
          <span>3</span>
          <p>The project is ready for deeper movement, multiplayer sync, and route logic on a safer baseline.</p>
        </div>
      </div>
    </div>
  );
}
