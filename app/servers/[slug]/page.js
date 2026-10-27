import { notFound } from "next/navigation";
import ServerDetailStats from "@/components/ServerDetailStats";
import { getServerBySlug, SERVER_DEFINITIONS } from "@/lib/serverData";

export function generateStaticParams() {
  return SERVER_DEFINITIONS.map((server) => ({ slug: server.slug }));
}

export async function generateMetadata({ params }) {
  params = await params;
  const server = getServerBySlug(params.slug);
  return {
    title: server?.shortTitle ?? "Server",
    description: server?.summary ?? "T-Central server route page.",
  };
}

export default async function DynamicServerPage({ params }) {
  params = await params;
  const server = getServerBySlug(params.slug);
  if (!server) notFound();
  return <ServerDetailStats server={server} />;
}
