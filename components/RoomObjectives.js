'use client';

import { buildOperationsState } from '@/lib/missionFramework';
import { useSteamSession } from '@/components/SteamSessionProvider';

export default function RoomObjectives({ activeNode = null, telemetry = null, progress = null }) {
  const { steamUser, universe, presence, lobbyMode } = useSteamSession();
  const operations = buildOperationsState({ lobbyMode, steamUser, activeNode, telemetry, presence, universe, progress });

  return (
    <div className="room-objectives">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Objectives</span>
        <strong>{operations.modeTitle}</strong>
      </div>
      <div className="room-objective-list">
        {operations.objectives.slice(0, 3).map((item) => (
          <div className="room-objective-item" key={item.id}>
            <span>{item.complete ? '✓' : '•'}</span>
            <p>
              <strong>{item.title}</strong><br />
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
