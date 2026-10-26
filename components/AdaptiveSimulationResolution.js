"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  adaptiveResolutionScale,
  simulationPixelRatio,
} from "@/lib/simulationDisplay";

export default function AdaptiveSimulationResolution({
  quality,
  viewport,
  onDprChange,
}) {
  const { gl, size } = useThree();
  const sample = useRef({ scale: 1, elapsed: 0, frames: 0, recovery: 0 });
  const apply = (scale) => {
    const dpr = simulationPixelRatio({
      ...viewport,
      width: size.width,
      height: size.height,
      quality,
      scale,
    });
    onDprChange(dpr);
    gl.domElement.dataset.renderDpr = dpr.toFixed(2);
  };
  useEffect(() => {
    sample.current = { scale: 1, elapsed: 0, frames: 0, recovery: 0 };
    apply(1);
  }, [
    quality,
    viewport.devicePixelRatio,
    viewport.isMobile,
    size.width,
    size.height,
    gl,
    onDprChange,
  ]);
  useFrame((_, delta) => {
    if (quality !== "auto" || document.hidden || delta <= 0) return;
    const current = sample.current;
    current.elapsed += Math.min(delta, 1);
    current.frames++;
    if (current.elapsed < 2) return;
    const average = (current.elapsed * 1000) / current.frames;
    current.recovery = average < 21 ? current.recovery + current.elapsed : 0;
    const next = adaptiveResolutionScale(
      current.scale,
      average,
      current.recovery,
    );
    if (next !== current.scale) {
      current.scale = next;
      current.recovery = 0;
      apply(next);
    }
    current.elapsed = 0;
    current.frames = 0;
  });
  return null;
}
