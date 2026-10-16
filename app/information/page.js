import Link from 'next/link';
import PageShell from '@/components/PageShell';
import DiscordPanel from '@/components/DiscordPanel';

const guides = [
  { title: 'Join a game server', text: 'Choose an Arma 3 or Rust route, check its game mode, then use Quick Connect with the Steam desktop app. You can also copy the address and join in-game.', href: '/server-info', label: 'Find a server' },
  { title: 'Explore in your browser', text: 'Open Play and launch the navigation system. Use WASD or arrow keys to fly, Space and Shift to change height, and Control to boost. On mobile, use the flight pad.', href: '/system', label: 'Open Play' },
  { title: 'Share updates and ideas', text: 'Read the community board for player posts. Sign in with Steam or Google to share feedback, suggest events, or start a discussion.', href: '/hub-form', label: 'Open community board' },
  { title: 'Play fairly', text: 'Respect other players, avoid cheating and harassment, and follow the rules of the server you join. Review the multiplayer policy before entering shared spaces.', href: '/multiplayer-policy', label: 'Read the multiplayer policy' },
  { title: 'Report a problem', text: 'For player misconduct, include the server, player name, and evidence in a report. For account or connection issues, contact the team directly.', href: '/report-player', label: 'Report a player' },
];

export const metadata = { title: 'Player guide', description: 'How to join T-Central servers, explore the universe, and get community support.' };

export default function InformationPage() {
  return (
    <PageShell eyebrow="Player guide" title="Find your way around T-Central." text="Start with a server, explore the universe, or connect with the community. Here is how to get going.">
      <div className="card-grid two">
        {guides.map((guide) => (
          <article key={guide.title} className="content-card">
            <h2>{guide.title}</h2>
            <p className="muted">{guide.text}</p>
            <Link className="button secondary" href={guide.href}>{guide.label}</Link>
          </article>
        ))}
      </div>
      <DiscordPanel />
    </PageShell>
  );
}
