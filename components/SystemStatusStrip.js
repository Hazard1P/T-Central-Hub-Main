'use client';

import { getSystemStatusPills } from '@/lib/siteContent';
import { useSteamSession } from '@/components/SteamSessionProvider';

export default function SystemStatusStrip() {
  const fallbackPills = getSystemStatusPills();
  const { universe, presence } = useSteamSession();
  const continuityDrill = universe?.continuityDrill;
  const drillLabel = continuityDrill?.result ? `Drill ${String(continuityDrill.result).toUpperCase()}` : 'Drill pending';

  const pills = universe?.epoch
    ? [
        { label: 'Epoch', value: universe.epoch.unix },
        { label: 'Dyson align', value: `${universe.epoch.dysonPercent}%` },
        { label: 'Prayer seeds', value: universe?.prayerSeeds?.total ?? 0 },
        { label: 'Pilots', value: presence.length },
        { label: 'Support', value: universe?.donations?.confirmed ?? 0 },
        { label: 'Continuity', value: drillLabel },
      ]
    : fallbackPills;

  return (
    <div className="system-status-strip sim-zone-top-status-auth">
      {pills.map((pill) => (
        <div className="status-strip-pill" key={`${pill.label}-${pill.value}`}>
          <span>{pill.label}</span>
          <strong>{pill.value}</strong>
        </div>
      ))}
    </div>
  );
}
