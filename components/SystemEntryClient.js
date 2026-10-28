"use client";

import { useEffect, useState } from "react";
import SystemLauncher from "@/components/SystemLauncher";
import SystemErrorBoundary from "@/components/SystemErrorBoundary";
import dynamic from "next/dynamic";
const StableSystemWorld = dynamic(
  () => import("@/components/StableSystemWorld"),
  {
    ssr: false,
    loading: () => (
      <p className="exploration-notice" role="status">
        Loading the universe…
      </p>
    ),
  },
);
import { MultiplayerSessionProvider } from "@/components/MultiplayerSessionProvider";
import { useSteamSession } from "@/components/SteamSessionProvider";
import { gameEngine } from "@/lib/gameEngine";
import { resolveSolarBody } from "@/lib/solarSystem";

function canUseWebGL() {
  if (typeof window === "undefined") return false;

  try {
    const canvas = window.document?.createElement?.("canvas");
    if (!canvas) return false;

    const context =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch (error) {
    console.warn("System WebGL preflight failed.", error);
    return false;
  }
}

export default function SystemEntryClient() {
  const [hudVisible, setHudVisible] = useState(true);
  useEffect(() => {
    const onHudToggle = (event) => setHudVisible(Boolean(event.detail));
    window.addEventListener("hudToggle", onHudToggle);
    return () => window.removeEventListener("hudToggle", onHudToggle);
  }, []);
  const [launchPhase, setLaunchPhase] = useState("idle");
  const [launchError, setLaunchError] = useState("");
  const [initialSolarBody, setInitialSolarBody] = useState(null);
  const { steamUser, lobbyMode, setLobbyMode, loading, sessionError } =
    useSteamSession();
  useEffect(() => {
    if (loading || sessionError || launchPhase !== "idle") return;
    const params = new URLSearchParams(window.location.search);
    const destination = params.get("destination");
    if (destination?.startsWith("solar-") || params.get("region") === "solar")
      handleEnter({
        mode: "hub",
        solarBody:
          resolveSolarBody(destination?.slice(6) || params.get("body")) ||
          "earth",
      });
  }, [loading, sessionError, launchPhase]);

  useEffect(() => {
    if (launchPhase !== "launching") return undefined;

    let cancelled = false;

    try {
      const transitionTimer = window.setTimeout(() => {
        if (!cancelled) setLaunchPhase("in_sim");
      }, 120);

      return () => {
        cancelled = true;
        window.clearTimeout(transitionTimer);
      };
    } catch (error) {
      console.error("System launch transition failed before 3D mount.", error);
      setLaunchPhase("error");
    }

    return undefined;
  }, [launchPhase]);

  useEffect(() => {
    if (launchPhase !== "in_sim" || typeof window === "undefined") return;

    try {
      gameEngine.init();
    } catch (error) {
      console.error(
        "Game engine initialization failed during simulation handoff.",
        error,
      );
      setLaunchPhase("error");
    }
    return () => gameEngine.destroy();
  }, [launchPhase]);

  const handleEnter = (options = {}) => {
    if (options.mode) setLobbyMode(options.mode);
    setInitialSolarBody(resolveSolarBody(options.solarBody));
    setLaunchError("");

    if (!canUseWebGL()) {
      setLaunchError(
        "Your browser could not start a WebGL context. Enable hardware acceleration or try another browser/device.",
      );
      setLaunchPhase("error");
      return;
    }

    setLaunchPhase("launching");
  };

  const resetLauncher = () => {
    setLaunchError("");
    setLaunchPhase("idle");
  };

  return (
    <div
      className={`system-entry-screen phase-${launchPhase}${hudVisible ? "" : " hud-hidden"}`}
    >
      <div
        className="system-launcher-layer"
        hidden={launchPhase === "in_sim"}
        inert={launchPhase === "in_sim" ? true : undefined}
        aria-hidden={launchPhase === "in_sim" ? true : undefined}
      >
        <SystemLauncher
          onEnter={handleEnter}
          enabled={launchPhase !== "in_sim"}
          errorMessage={
            launchPhase === "error"
              ? launchError ||
                "The universe could not start. Try launching again."
              : ""
          }
          onReset={resetLauncher}
        />
      </div>
      {launchPhase === "in_sim" ? (
        <main
          className="system-game-layer"
          aria-label="Space and Time simulation"
        >
          <SystemErrorBoundary onReset={resetLauncher}>
            <MultiplayerSessionProvider>
              <StableSystemWorld
                lobbyMode={lobbyMode}
                steamUser={steamUser}
                onModeChange={setLobbyMode}
                initialSolarBody={initialSolarBody}
              />
            </MultiplayerSessionProvider>
          </SystemErrorBoundary>
        </main>
      ) : null}
    </div>
  );
}
