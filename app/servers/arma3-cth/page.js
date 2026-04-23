import Image from 'next/image';
import PageShell from '@/components/PageShell';
import ServerConnectActions from '@/components/ServerConnectActions';
import { getServerBySlug } from '@/lib/serverData';

export const metadata = { title: 'Arma3 CTH' };

const futureProspects = [
  'Expanded dynamic server browser integration from the blackhole interior.',
  'Richer event nights, rotating hill layouts, and curated tactical sessions.',
  'Progression, stat tracking, and stronger website-to-server handoff.',
  'Better live status visibility and more direct launch paths through Steam.',
];

const cthPoints = [
  'Capture the Hill is built around control of a central objective under constant team pressure.',
  'Players re-enter quickly, contest the hill, and fight for territory, score, and momentum.',
  'The mode works best when the travel time stays low and the objective stays active.',
  'T-Central is aiming for a cleaner tactical loop: fast entry, clear action, repeat sessions.',
];

export default function ArmaPage() {
  const server = getServerBySlug('arma3-cth');
  const serverIp = server?.ip || 'tcentral.game.nfoservers.com:2302';
  const integration = server?.integration;

  return (
    <PageShell
      eyebrow="Arma3 CTH"
      title="Capture the Hill, deploy fast, and stay in the fight."
      text="This page is the practical entry point for the single live T-Central Arma3 Capture the Hill server, with quick connect actions, a clear server route, and a briefing on where the mode is headed."
    >
      <div className="arma-entry-grid">
        <article className="content-card">
          <p className="eyebrow">Quick connect</p>
          <h3>{serverIp}</h3>
          <p className="muted">
            Launch Arma 3, copy the server IP, or use the Steam quick-connect handoff to get into the T-Central CTH route faster.
          </p>

          <ServerConnectActions
            serverIp={serverIp}
            steamAppId="107410"
            launchLabel="Launch Arma 3"
            connectLabel="Quick Connect"
          />

          <div className="server-inline-meta">
            <span>Game: Arma 3</span>
            <span>Mode: Capture the Hill</span>
            <span>Route: Public tactical server</span>
          </div>

          {integration ? (
            <div className="server-inline-meta">
              <span>Server ID: {integration.serverId}</span>
              <span>PBO: {integration.pboPackage}</span>
              <span>Mission: {integration.missionId}</span>
            </div>
          ) : null}
        </article>

        <article className="content-card arma-hero-image-card">
          <Image
            src="/arma-cth-shot.png"
            alt="Arma 3 CTH map and command reference"
            width={1366}
            height={1024}
            className="page-image"
            priority
          />
        </article>
      </div>

      <div className="arma-brief-grid">
        <article className="content-card">
          <p className="eyebrow">What CTH is</p>
          <h3>Briefing</h3>
          <ul className="arma-list">
            {cthPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>

        <article className="content-card">
          <p className="eyebrow">Map reference</p>
          <h3>Visual context</h3>
          <div className="arma-highlight">
            <strong>Current map and field reference</strong>
            <p className="muted">
              This page restores the Altis battlefield image so players have a quick visual reference for the Arma3 CTH environment before joining.
            </p>
          </div>
          <div className="arma-highlight">
            <strong>Join priority</strong>
            <p className="muted">
              The page is meant to shorten the path from website → Steam → server as much as possible.
            </p>
          </div>
        </article>

        <article className="content-card">
          <p className="eyebrow">Future prospects</p>
          <h3>Where it can go next</h3>
          <ul className="arma-list">
            {futureProspects.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>

        <article className="content-card">
          <p className="eyebrow">System integration</p>
          <h3>PBO + server ID wiring</h3>
          <ul className="arma-list">
            <li>Server build: {integration?.serverBuild || 'KOTH rebuild pipeline'}</li>
            <li>Server ID: {integration?.serverId || 'tcentral-arma3-cth-01'}</li>
            <li>PBO package: {integration?.pboPackage || 'tcentral_koth_hub.pbo'}</li>
            <li>PBO mount: {integration?.pboMount || '@tcentral_kothhub/addons/tcentral_koth_hub.pbo'}</li>
            <li>Mission key: {integration?.missionId || 'koth_altis_rebuild'}</li>
            <li>Mission version: {integration?.missionVersion || '2026.04.23'}</li>
            <li>Account storage table: {integration?.accountStorage || 'player_progression'}</li>
            <li>
              VIP system: {integration?.vipSystem?.enabled ? 'enabled' : 'pending'}
              {integration?.vipSystem?.tiers?.length ? ` (${integration.vipSystem.tiers.join(', ')})` : ''}
            </li>
          </ul>
        </article>
      </div>

      <div className="arma-entry-grid">
        <article className="content-card arma-hero-image-card">
          <Image
            src="/arma-cth-shot.png"
            alt="Uploaded Arma reference photo"
            width={1366}
            height={1024}
            className="page-image"
          />
        </article>

        <article className="content-card">
          <p className="eyebrow">Altis map reference</p>
          <h3>Additional battlefield reference</h3>
          <p className="muted">
            This keeps the Arma3 route visually aligned around the Altis battlefield map for a cleaner and more consistent server entry.
          </p>
          <div className="server-inline-meta">
            <span>Server IP: tcentral.game.nfoservers.com:2302</span>
            <span>One live server overall</span>
          </div>
        </article>
      </div>
    </PageShell>
  );
}
