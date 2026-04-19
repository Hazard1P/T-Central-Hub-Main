export function getEventHorizonMaterialProps({ color = '#9fdcff', strength = 1 } = {}) {
  return {
    primaryColor: color,
    haloOpacity: Number((0.12 * strength).toFixed(3)),
    ringOpacity: Number((0.72 * strength).toFixed(3)),
    distortion: Number((0.8 * strength).toFixed(3)),
  };
}
