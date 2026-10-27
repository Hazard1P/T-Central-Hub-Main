import { NextResponse } from "next/server";
import { continuityHealthService } from "@/lib/continuity/continuityHealthService";
export const dynamic = "force-dynamic";
export async function GET() {
  const latest = continuityHealthService.latestSnapshot,
    snapshot = latest || continuityHealthService.evaluate();
  const ok = snapshot.gateStatus === "open";
  return NextResponse.json(
    {
      ok,
      warnings:
        snapshot.durabilityStatus === "durable"
          ? []
          : ["Runtime state does not establish durable recovery."],
      continuityHealth: {
        gateStatus: snapshot.gateStatus,
        ringHealth: snapshot.ringHealth,
        crossSphereIntegrity: snapshot.crossSphereIntegrity,
        timestampUnix: snapshot.timestampUnix,
        durabilityStatus: snapshot.durabilityStatus,
      },
      launchGate: { status: snapshot.gateStatus, authoritative: "runtime" },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
