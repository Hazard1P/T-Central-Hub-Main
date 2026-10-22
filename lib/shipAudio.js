export const SHIP_AUDIO_STORAGE_KEY = "tcentral_audio_v1";
export const DEFAULT_SHIP_AUDIO = Object.freeze({
  muted: false,
  effects: 0.45,
  hum: 0.03,
});

export function normalizeShipAudio(value = {}) {
  const volume = (key) =>
    typeof value?.[key] === "number" && Number.isFinite(value[key])
      ? Math.max(0, Math.min(1, value[key]))
      : DEFAULT_SHIP_AUDIO[key];
  return {
    muted: value?.muted === true,
    effects: volume("effects"),
    hum: volume("hum"),
  };
}

// One lazy Web Audio graph per flight. No downloads or continuously scheduled shots.
export function createShipAudio({
  AudioContextClass,
  settings = DEFAULT_SHIP_AUDIO,
} = {}) {
  let preferences = normalizeShipAudio(settings),
    active = true,
    disposed = false;
  let context, master, ambience, effects, unlockPromise, suspendTimer;
  let pendingPulse = false,
    pulseGeneration = 0;
  const continuous = new Set(),
    voices = new Set();
  const audible = () =>
    active &&
    !preferences.muted &&
    (preferences.effects > 0 || preferences.hum > 0) &&
    !disposed;
  const fade = (parameter, value) => {
    parameter.cancelScheduledValues(context.currentTime);
    parameter.setTargetAtTime(value, context.currentTime, 0.02);
  };
  const disconnect = (nodes) =>
    nodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {}
    });

  function initialize() {
    context = new AudioContextClass({ latencyHint: "interactive" });
    master = context.createGain();
    master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    master.connect(limiter);
    limiter.connect(context.destination);
    ambience = context.createGain();
    ambience.gain.value = preferences.hum * 0.15;
    effects = context.createGain();
    effects.gain.value = preferences.effects;
    ambience.connect(master);
    effects.connect(master);
    for (const [frequency, amplitude] of [
      [44, 0.55],
      [88.2, 0.24],
      [132.1, 0.12],
    ]) {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = amplitude;
      oscillator.connect(gain);
      gain.connect(ambience);
      oscillator.start();
      continuous.add(oscillator);
    }
    // Slow breathing adds depth without a conspicuous loop or musical melody.
    const breath = context.createOscillator(),
      depth = context.createGain();
    breath.frequency.value = 0.09;
    breath.connect(depth);
    depth.connect(ambience.gain);
    breath.start();
    continuous.add(breath);
    // Modulation must scale with the hum volume, including a true zero setting.
    depth.gain.value = preferences.hum * 0.025;
    ambience.depth = depth;
    return context;
  }

  function applySettings() {
    if (!context || context.state === "closed") return;
    fade(master.gain, audible() ? 0.75 : 0);
    fade(effects.gain, preferences.effects);
    fade(ambience.gain, preferences.hum * 0.15);
    fade(ambience.depth.gain, preferences.hum * 0.025);
    clearTimeout(suspendTimer);
    if (!audible()) {
      pulseGeneration += 1;
      pendingPulse = false;
      // Let the gain ramp finish before stopping the audio clock.
      suspendTimer = setTimeout(() => {
        if (!audible() && context.state === "running")
          void context.suspend().catch(() => {});
      }, 100);
    }
  }

  function unlock() {
    if (!AudioContextClass || !audible()) return Promise.resolve(false);
    if (unlockPromise && context?.state === "running") return unlockPromise;
    // A resume requested before mobile activation can remain pending; retry on
    // subsequent gestures rather than blocking every later tap behind it.
    try {
      if (!context) initialize();
      applySettings();
      const pending = context
        .resume()
        .then(() => !disposed && context.state === "running")
        .catch(() => false);
      unlockPromise = pending;
      void pending.then(() => {
        if (unlockPromise === pending) unlockPromise = null;
      });
      return unlockPromise;
    } catch {
      return Promise.resolve(false);
    }
  }

  function pulse() {
    if (
      !context ||
      context.state !== "running" ||
      !audible() ||
      preferences.effects === 0 ||
      voices.size >= 6
    )
      return;
    const now = context.currentTime,
      envelope = context.createGain(),
      filter = context.createBiquadFilter();
    const core = context.createOscillator(),
      overtone = context.createOscillator(),
      overtoneGain = context.createGain();
    core.type = "triangle";
    core.frequency.setValueAtTime(820, now);
    core.frequency.exponentialRampToValueAtTime(92, now + 0.14);
    overtone.type = "sawtooth";
    overtone.frequency.setValueAtTime(1480, now);
    overtone.frequency.exponentialRampToValueAtTime(180, now + 0.11);
    overtoneGain.gain.value = 0.12;
    filter.type = "lowpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.15);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.2, now + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    envelope.gain.linearRampToValueAtTime(0, now + 0.18);
    core.connect(filter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(envelope);
    envelope.connect(effects);
    const voice = {
      core,
      overtone,
      nodes: [core, overtone, overtoneGain, filter, envelope],
    };
    voices.add(voice);
    core.onended = () => {
      voices.delete(voice);
      disconnect(voice.nodes);
    };
    core.start(now);
    overtone.start(now);
    core.stop(now + 0.19);
    overtone.stop(now + 0.19);
  }

  return {
    unlock,
    fire() {
      if (!audible()) return;
      if (context?.state === "running") pulse();
      else if (unlockPromise && !pendingPulse) {
        const generation = pulseGeneration;
        pendingPulse = true;
        void unlockPromise.then((ready) => {
          if (generation !== pulseGeneration) return;
          pendingPulse = false;
          if (ready) pulse();
        });
      }
    },
    setSettings(next) {
      preferences = normalizeShipAudio(next);
      applySettings();
    },
    setActive(next) {
      active = Boolean(next);
      applySettings();
      // Previously unlocked contexts can usually resume after a tab returns.
      if (context && audible()) void unlock();
    },
    dispose() {
      disposed = true;
      clearTimeout(suspendTimer);
      for (const voice of voices) {
        for (const oscillator of [voice.core, voice.overtone]) {
          try {
            oscillator.stop();
          } catch {}
        }
        disconnect(voice.nodes);
      }
      voices.clear();
      for (const oscillator of continuous) {
        try {
          oscillator.stop();
        } catch {}
      }
      continuous.clear();
      if (context) {
        master?.disconnect();
        void context.close().catch(() => {});
      }
    },
  };
}
