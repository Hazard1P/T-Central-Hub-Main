// Stable subsection keys keep discussion placement consistent across clients and storage.
export const COMMUNITY_SECTIONS = [
  {
    key: "space-time",
    title: "Space & Time",
    description: "Explore the shared universe and build your flight skills.",
    boards: [
      {
        key: "space-exploration",
        title: "Exploration routes",
        description: "Discoveries, destinations and navigation tips.",
        category: "General",
      },
      {
        key: "shipyard-mining",
        title: "Shipyard & mining",
        description: "Mining routes, ship upgrades and resource runs.",
        category: "General",
      },
      {
        key: "combat-crews",
        title: "Combat & crews",
        description: "Flight tactics and finding a crew.",
        category: "General",
      },
    ],
  },
  {
    key: "game-communities",
    title: "Game communities",
    description: "Find people and plan sessions on independent game servers.",
    boards: [
      {
        key: "rust-servers",
        title: "Rust servers",
        description: "Server recommendations, wipes and team plans.",
        category: "Server feedback",
      },
      {
        key: "arma-operations",
        title: "Arma operations",
        description: "Operations, units, mods and server feedback.",
        category: "Server feedback",
      },
      {
        key: "looking-for-group",
        title: "Looking for a group",
        description: "Find teammates and arrange your next session.",
        category: "General",
      },
    ],
  },
  {
    key: "development",
    title: "Project development",
    description: "Help shape the project with useful, specific feedback.",
    boards: [
      {
        key: "bugs-help",
        title: "Bugs & technical help",
        description: "Describe the issue, device and steps to reproduce it.",
        category: "Bug report",
      },
      {
        key: "feature-ideas",
        title: "Feature ideas",
        description: "Suggest improvements and explain how they help players.",
        category: "Feature idea",
      },
      {
        key: "graphics-mobile",
        title: "Graphics & mobile",
        description: "Visual feedback, phone controls and performance.",
        category: "Feature idea",
      },
    ],
  },
  {
    key: "community",
    title: "Community lounge",
    description: "Meet other players and keep the conversation going.",
    boards: [
      {
        key: "introductions",
        title: "Introductions",
        description: "Introduce yourself and share what you enjoy playing.",
        category: "General",
      },
      {
        key: "events",
        title: "Events & meetups",
        description: "Organize community sessions and share event details.",
        category: "Events",
      },
      {
        key: "general-discussion",
        title: "General discussion",
        description: "Questions and conversations about the community.",
        category: "General",
      },
      {
        key: "community-guidelines",
        title: "Community guidelines",
        description:
          "Discuss the rules; send private evidence through player reports.",
        category: "Moderation",
      },
    ],
  },
];
export const COMMUNITY_BOARDS = COMMUNITY_SECTIONS.flatMap((section) =>
  section.boards.map((board) => ({
    ...board,
    sectionKey: section.key,
    sectionTitle: section.title,
  })),
);
const LEGACY_BOARDS = {
  General: "general-discussion",
  "Server feedback": "general-discussion",
  "Bug report": "bugs-help",
  Events: "events",
  "Feature idea": "feature-ideas",
  Moderation: "community-guidelines",
};
export function communityBoard(key) {
  return COMMUNITY_BOARDS.find((board) => board.key === key) || null;
}
export function boardForPost(post) {
  return (
    communityBoard(post?.board) ||
    communityBoard(LEGACY_BOARDS[post?.category] || "general-discussion")
  );
}
