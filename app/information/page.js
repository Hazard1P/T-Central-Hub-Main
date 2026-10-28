import Link from "next/link";
import PageShell from "@/components/PageShell";
import DiscordPanel from "@/components/DiscordPanel";

const guides = [
  {
    title: "Join a game server",
    text: "Choose Rust or Arma 3, select an independently operated server, and review its rules and connection details. Use Steam on desktop or copy the address to join in-game. T-Central does not currently host active game servers.",
    href: "/server-info",
    label: "Find a server",
  },
  {
    title: "Explore in your browser",
    text: "Open Play and join the shared universe. Your room shows its current population and available slots; share its invite from Pilots. Use WASD or arrow keys to fly, Space and Shift to change height, and Control to boost. On mobile, use the flight pad.",
    href: "/system",
    label: "Open Play",
  },
  {
    title: "Land on Earth",
    text: "Choose Pacific, Atlantic or Southern Spaceport in Explore and cruise toward it. The detailed 3D surface appears as you approach. Brake below 8 u/s near a free pad, then select Land or press E. Take off with the same control to fly over the terrain and return to orbit. Earth’s safe zone blocks weapons and incoming player fire; combat begins outside its green boundary.",
    href: "/system",
    label: "Explore Earth",
  },
  {
    title: "Mine and upgrade your ship",
    text: "In a shared flight, open Shipyard and fly to the Earth mining field. Approach a rock, brake and mine it, then fly back to Earth and unload for game credits. Install cargo and laser upgrades at Earth. Your account profile shows saved ship progress; guest training stays with its browser session.",
    href: "/profile",
    label: "View your ship progress",
  },
  {
    title: "Share updates and ideas",
    text: "Read the community board for player posts. Sign in with Steam or Google to share feedback, suggest events, or start a discussion.",
    href: "/hub-form",
    label: "Open community board",
  },
  {
    title: "Play fairly",
    text: "Respect other players, avoid cheating and harassment, and follow the rules of the server you join. Review the multiplayer policy before entering shared spaces.",
    href: "/multiplayer-policy",
    label: "Read the multiplayer policy",
  },
  {
    title: "Report a problem",
    text: "For player misconduct, include the server, player name, and evidence in a report. For account or connection issues, contact the team directly.",
    href: "/report-player",
    label: "Report a player",
  },
];

export const metadata = {
  title: "Player guide",
  description:
    "How to discover community servers, explore the universe, and get support.",
};

export default function InformationPage() {
  return (
    <PageShell
      eyebrow="Player guide"
      title="Find your way around T-Central."
      text="Start with a server, explore the universe, or connect with the community. Here is how to get going."
    >
      <div className="card-grid two">
        {guides.map((guide) => (
          <article key={guide.title} className="content-card">
            <h2>{guide.title}</h2>
            <p className="muted">{guide.text}</p>
            <Link className="button secondary" href={guide.href}>
              {guide.label}
            </Link>
          </article>
        ))}
      </div>
      <DiscordPanel />
    </PageShell>
  );
}
