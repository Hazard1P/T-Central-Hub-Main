import { clamp } from '@/lib/mathEngine';

export function buildDynamicEngineState({ telemetry = {}, flightConfig = {}, operations = null, singularity = null, entropic = null }) {
  const speed = Number(telemetry.speed || 0);
  const gravity = Number(telemetry.gravity || 0);
  const coherence = Number(telemetry.quantum?.coherencePercent || 50) / 100;
  const entropy = Number(telemetry.quantum?.entropyPercent || 50) / 100;
  const engineLoad = clamp(speed / 18 + gravity / 28 + entropy * 0.32, 0, 1.8);
  const routeStability = clamp((flightConfig.routeAssist ? 0.3 : 0.14) + (flightConfig.inertialDampers ? 0.34 : 0.18) + coherence * 0.42, 0, 1.24);
  const missionPressure = clamp((operations?.completionPercent || 0) / 100 * 0.42 + (entropic?.unresolved || 0) * 0.03, 0, 1.5);

  return {
    engineLoad: Number(engineLoad.toFixed(3)),
    routeStability: Number(routeStability.toFixed(3)),
    missionPressure: Number(missionPressure.toFixed(3)),
    singularityWindow: Number((singularity?.resolvedWindow || 0).toFixed(3)),
    dynamicBalance: Number(clamp(routeStability - engineLoad * 0.38 - missionPressure * 0.24 + (singularity?.resolvedWindow || 0) * 0.26, 0, 1.4).toFixed(3)),
  };
}
