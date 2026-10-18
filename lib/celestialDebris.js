export function debrisNoise(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function createDebrisField(count = 80, localOrbit = false) {
  const near = localOrbit ? [[2, -1, 31], [-5, 3, 39], [12, -6, 48]] : [[2, -1, 39], [-5, 3, 48], [12, -6, 61]];
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.399963, distance = localOrbit ? 45 + debrisNoise(index + 1) * 65 : 45 + debrisNoise(index + 1) * 18;
    return {
      id: 'rock-' + index,
      position: near[index] || [Math.cos(angle) * distance, -7 + (debrisNoise(index + 87) - .5) * (localOrbit ? 70 : 9), (localOrbit ? 45 : 30) + Math.sin(angle) * distance],
      radius: index < 3 ? 1.2 + index * .22 : .3 + debrisNoise(index + 34) * 1.05,
      rotation: [index * 1.7, index * .7, index * .3],
      seed: index + 1,
    };
  });
}
