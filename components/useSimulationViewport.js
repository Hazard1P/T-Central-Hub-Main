"use client";
import { useEffect, useState } from "react";
import { visibleSimulationViewport } from "@/lib/simulationDisplay";

function readViewport() {
  if (typeof window === "undefined") return visibleSimulationViewport();
  return visibleSimulationViewport({
    width: window.innerWidth,
    height: window.innerHeight,
    visual: window.visualViewport,
    coarse: window.matchMedia("(pointer: coarse)").matches,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    dpr: window.devicePixelRatio,
  });
}
export default function useSimulationViewport() {
  const [viewport, setViewport] = useState(readViewport);
  useEffect(() => {
    let frame = null;
    const coarse = window.matchMedia("(pointer: coarse)"),
      motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      frame = null;
      const next = readViewport();
      setViewport((current) =>
        Object.keys(next).every((key) => next[key] === current[key])
          ? current
          : next,
      );
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    const visual = window.visualViewport,
      orientation = window.screen?.orientation;
    const targets = [
      [window, "resize"],
      [window, "orientationchange"],
      [visual, "resize"],
      [visual, "scroll"],
      [orientation, "change"],
      [coarse, "change"],
      [motion, "change"],
    ];
    for (const [target, event] of targets)
      target?.addEventListener?.(event, schedule);
    update();
    return () => {
      for (const [target, event] of targets)
        target?.removeEventListener?.(event, schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
  return viewport;
}
