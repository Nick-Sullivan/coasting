// Weighted mean colour where pixels closer to (cx, cy) have quadratic falloff weight.
export function calculateCenterWeightedColor(
  imageData: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  cx: number,
  cy: number,
): { r: number; g: number; b: number } | null {
  let maxDist = 0;
  for (let i = 0; i < mask.length; i += 4) {
    if (mask[i] === 255) {
      const pi = i / 4;
      const dist = Math.hypot((pi % width) - cx, Math.floor(pi / width) - cy);
      if (dist > maxDist) maxDist = dist;
    }
  }
  if (maxDist === 0) maxDist = 1;

  let rSum = 0,
    gSum = 0,
    bSum = 0,
    totalWeight = 0;
  for (let i = 0; i < mask.length; i += 4) {
    if (mask[i] === 255) {
      const pi = i / 4;
      const dist = Math.hypot((pi % width) - cx, Math.floor(pi / width) - cy);
      const w = Math.pow(1 - dist / maxDist, 2);
      rSum += imageData[i] * w;
      gSum += imageData[i + 1] * w;
      bSum += imageData[i + 2] * w;
      totalWeight += w;
    }
  }
  if (totalWeight === 0) return null;

  return {
    r: Math.round(rSum / totalWeight),
    g: Math.round(gSum / totalWeight),
    b: Math.round(bSum / totalWeight),
  };
}

export function calculateMedianColor(
  imageData: Uint8ClampedArray,
  mask: Uint8ClampedArray,
): { r: number; g: number; b: number } | null {
  const rValues: number[] = [];
  const gValues: number[] = [];
  const bValues: number[] = [];

  for (let i = 0; i < mask.length; i += 4) {
    if (mask[i] === 255) {
      rValues.push(imageData[i]);
      gValues.push(imageData[i + 1]);
      bValues.push(imageData[i + 2]);
    }
  }

  if (rValues.length === 0) return null;

  rValues.sort((a, b) => a - b);
  gValues.sort((a, b) => a - b);
  bValues.sort((a, b) => a - b);

  const mid = Math.floor(rValues.length / 2);
  return {
    r: rValues[mid],
    g: gValues[mid],
    b: bValues[mid],
  };
}
