"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createShipAudio,
  DEFAULT_SHIP_AUDIO,
  normalizeShipAudio,
  SHIP_AUDIO_STORAGE_KEY,
} from "@/lib/shipAudio";

export default function useShipAudio({ enabled = true } = {}) {
  const engine = useRef(null),
    preferences = useRef(DEFAULT_SHIP_AUDIO),
    active = useRef(enabled);
  active.current = enabled;
  const [settings, setSettings] = useState(DEFAULT_SHIP_AUDIO);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    try {
      preferences.current = normalizeShipAudio(
        JSON.parse(localStorage.getItem(SHIP_AUDIO_STORAGE_KEY)),
      );
    } catch {}
    setSettings(preferences.current);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    setSupported(Boolean(AudioContextClass));
    const audio = createShipAudio({
      AudioContextClass,
      settings: preferences.current,
    });
    engine.current = audio;
    const visibility = () =>
      audio.setActive(active.current && document.visibilityState === "visible");
    const gesture = () => {
      if (active.current && document.visibilityState === "visible")
        void audio.unlock();
    };
    visibility();
    window.addEventListener("pointerdown", gesture, { passive: true });
    window.addEventListener("keydown", gesture);
    window.addEventListener("touchend", gesture, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerdown", gesture);
      window.removeEventListener("keydown", gesture);
      window.removeEventListener("touchend", gesture);
      document.removeEventListener("visibilitychange", visibility);
      audio.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setActive(
      enabled && document.visibilityState === "visible",
    );
  }, [enabled]);
  const change = useCallback((patch) => {
    const next = normalizeShipAudio({ ...preferences.current, ...patch });
    preferences.current = next;
    setSettings(next);
    try {
      localStorage.setItem(SHIP_AUDIO_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    engine.current?.setSettings(next);
    if (active.current && document.visibilityState === "visible")
      void engine.current?.unlock();
  }, []);
  const fire = useCallback(() => engine.current?.fire(), []);
  return { settings, change, supported, fire };
}
