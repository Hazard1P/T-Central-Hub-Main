const VECTOR3_EPSILON = 1e-6;

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function resolveVector3(input, fallback = [0, 0, 0]) {
  const safeFallback = [
    toFiniteNumber(fallback?.[0], 0),
    toFiniteNumber(fallback?.[1], 0),
    toFiniteNumber(fallback?.[2], 0),
  ];

  if (!Array.isArray(input) || input.length < 3) return safeFallback;

  return [
    toFiniteNumber(input[0], safeFallback[0]),
    toFiniteNumber(input[1], safeFallback[1]),
    toFiniteNumber(input[2], safeFallback[2]),
  ];
}

export function normalizeVector3(input, fallback = [0, 0, -1], epsilon = VECTOR3_EPSILON) {
  const safeFallback = resolveVector3(fallback, [0, 0, -1]);
  const source = resolveVector3(input, safeFallback);

  const sourceLengthSq = (source[0] ** 2) + (source[1] ** 2) + (source[2] ** 2);
  const safeEpsilon = Math.max(Number(epsilon) || VECTOR3_EPSILON, VECTOR3_EPSILON);

  const normalize = (vector) => {
    const length = Math.sqrt((vector[0] ** 2) + (vector[1] ** 2) + (vector[2] ** 2));
    if (length <= safeEpsilon) return [0, 0, -1];
    return vector.map((value) => value / length);
  };

  if (sourceLengthSq <= safeEpsilon * safeEpsilon) {
    return normalize(safeFallback);
  }

  return normalize(source);
}
