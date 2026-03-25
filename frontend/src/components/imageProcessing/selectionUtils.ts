// Single pass of a 3×3 Gaussian blur on a grayscale Uint8Array.
function gaussianBlur(
  src: Uint8Array<ArrayBuffer>,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  const dst = new Uint8Array(src.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      dst[i] =
        (src[i - width - 1] +
          src[i - width] * 2 +
          src[i - width + 1] +
          src[i - 1] * 2 +
          src[i] * 4 +
          src[i + 1] * 2 +
          src[i + width - 1] +
          src[i + width] * 2 +
          src[i + width + 1]) >>
        4; // divide by 16
    }
  }
  // Copy border rows/cols unchanged
  for (let x = 0; x < width; x++) {
    dst[x] = src[x];
    dst[(height - 1) * width + x] = src[(height - 1) * width + x];
  }
  for (let y = 0; y < height; y++) {
    dst[y * width] = src[y * width];
    dst[y * width + width - 1] = src[y * width + width - 1];
  }
  return dst;
}

// Sobel edge detection with Gaussian pre-blur, result normalised to 0-255.
export function computeEdgeMap(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  let gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(
      0.299 * imageData[i * 4] +
        0.587 * imageData[i * 4 + 1] +
        0.114 * imageData[i * 4 + 2],
    );
  }

  // Two passes of Gaussian blur suppress fine texture before edge detection
  gray = gaussianBlur(gray, width, height);
  gray = gaussianBlur(gray, width, height);

  const edges = new Float32Array(width * height);
  let maxEdge = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -gray[(y - 1) * width + (x - 1)] +
        gray[(y - 1) * width + (x + 1)] +
        -2 * gray[y * width + (x - 1)] +
        2 * gray[y * width + (x + 1)] +
        -gray[(y + 1) * width + (x - 1)] +
        gray[(y + 1) * width + (x + 1)];
      const gy =
        -gray[(y - 1) * width + (x - 1)] -
        2 * gray[(y - 1) * width + x] -
        gray[(y - 1) * width + (x + 1)] +
        gray[(y + 1) * width + (x - 1)] +
        2 * gray[(y + 1) * width + x] +
        gray[(y + 1) * width + (x + 1)];
      edges[idx] = Math.sqrt(gx * gx + gy * gy);
      if (edges[idx] > maxEdge) maxEdge = edges[idx];
    }
  }
  if (maxEdge > 0) {
    for (let i = 0; i < edges.length; i++)
      edges[i] = (edges[i] / maxEdge) * 255;
  }
  return edges;
}

// BFS from (seedX, seedY), stays within polygonMask.
// Stopping criterion: edgeStrength * colourDiff > threshold * 100.
// Using the product means an internal line with the same colour on both sides
// (high edge, low colourDiff) won't stop the fill — only true object boundaries
// (high edge AND high colourDiff) will.
// Seed colour is sampled from a small neighbourhood around (seedX, seedY).
export function edgeFloodFill(
  edgeMap: Float32Array,
  imageData: Uint8ClampedArray,
  polygonMask: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  threshold: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height * 4);
  const visited = new Uint8Array(width * height);

  const sx = Math.round(seedX);
  const sy = Math.round(seedY);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return result;

  const startIdx = sy * width + sx;
  if (polygonMask[startIdx * 4] !== 255) return result;

  // Sample seed colour from a 5-pixel radius neighbourhood
  let seedR = 0,
    seedG = 0,
    seedB = 0,
    seedCount = 0;
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const nx = sx + dx,
        ny = sy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = (ny * width + nx) * 4;
      if (polygonMask[ni] !== 255) continue;
      seedR += imageData[ni];
      seedG += imageData[ni + 1];
      seedB += imageData[ni + 2];
      seedCount++;
    }
  }
  if (seedCount === 0) return result;
  seedR /= seedCount;
  seedG /= seedCount;
  seedB /= seedCount;

  const stopScore = threshold * 100;
  const queue: number[] = [startIdx];
  visited[startIdx] = 1;
  const ddx = [1, -1, 0, 0];
  const ddy = [0, 0, 1, -1];

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    result[idx * 4] = 255;
    result[idx * 4 + 3] = 255;

    const x = idx % width;
    const y = Math.floor(idx / width);
    for (let d = 0; d < 4; d++) {
      const nx = x + ddx[d];
      const ny = y + ddy[d];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx] || polygonMask[nIdx * 4] !== 255) continue;
      const ni = nIdx * 4;
      const colourDiff = Math.sqrt(
        (imageData[ni] - seedR) ** 2 +
          (imageData[ni + 1] - seedG) ** 2 +
          (imageData[ni + 2] - seedB) ** 2,
      );
      if (edgeMap[nIdx] * colourDiff > stopScore) continue;
      visited[nIdx] = 1;
      queue.push(nIdx);
    }
  }
  return result;
}

// Shrinks a mask inward by `radius` pixels using a BFS distance transform.
// O(width*height) regardless of radius.
export function erodeMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) return mask;

  const dist = new Int32Array(width * height).fill(-1);
  const queue: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx * 4] !== 255) continue;
      const isBoundary =
        x === 0 ||
        x === width - 1 ||
        y === 0 ||
        y === height - 1 ||
        mask[(idx - 1) * 4] !== 255 ||
        mask[(idx + 1) * 4] !== 255 ||
        mask[(idx - width) * 4] !== 255 ||
        mask[(idx + width) * 4] !== 255;
      if (isBoundary) {
        dist[idx] = 0;
        queue.push(idx);
      }
    }
  }

  const ddx = [1, -1, 0, 0];
  const ddy = [0, 0, 1, -1];
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % width;
    const y = Math.floor(idx / width);
    for (let d = 0; d < 4; d++) {
      const nx = x + ddx[d];
      const ny = y + ddy[d];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (mask[nIdx * 4] !== 255 || dist[nIdx] >= 0) continue;
      dist[nIdx] = dist[idx] + 1;
      queue.push(nIdx);
    }
  }

  const result = new Uint8ClampedArray(mask.length);
  for (let i = 0; i < width * height; i++) {
    if (dist[i] > radius) {
      result[i * 4] = 255;
      result[i * 4 + 3] = 255;
    }
  }
  return result;
}

export function traceBoundary(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  const grid = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 4) {
    if (mask[i] > 0) {
      grid[i / 4] = 1;
    }
  }

  let startX = -1,
    startY = -1;
  for (let y = 0; y < height && startX === -1; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (grid[idx] === 1) {
        if (
          x === 0 ||
          y === 0 ||
          x === width - 1 ||
          y === height - 1 ||
          grid[idx - 1] === 0 ||
          grid[idx + 1] === 0 ||
          grid[idx - width] === 0 ||
          grid[idx + width] === 0
        ) {
          startX = x;
          startY = y;
          break;
        }
      }
    }
  }

  if (startX === -1) return [];

  const boundary: Array<{ x: number; y: number }> = [];
  const directions = [
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
  ];

  let x = startX,
    y = startY;
  let dir = 7;

  do {
    boundary.push({ x, y });

    let found = false;
    for (let i = 0; i < 8; i++) {
      const checkDir = (dir + i) % 8;
      const nx = x + directions[checkDir].dx;
      const ny = y + directions[checkDir].dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = ny * width + nx;
        if (grid[idx] === 1) {
          x = nx;
          y = ny;
          dir = (checkDir + 6) % 8;
          found = true;
          break;
        }
      }
    }

    if (!found || boundary.length > width * height) break;
  } while (x !== startX || y !== startY || boundary.length < 3);

  const step = Math.max(1, Math.floor(boundary.length / 200));
  const simplified: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < boundary.length; i += step) {
    simplified.push(boundary[i]);
  }

  return simplified.length > 0 ? simplified : boundary;
}

export function createPolygonMask(
  path: Array<{ x: number; y: number }>,
  width: number,
  height: number,
): Uint8ClampedArray {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d")!;

  tempCtx.beginPath();
  tempCtx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    tempCtx.lineTo(path[i].x, path[i].y);
  }
  tempCtx.closePath();
  tempCtx.clip();
  tempCtx.fillStyle = "white";
  tempCtx.fillRect(0, 0, width, height);

  return tempCtx.getImageData(0, 0, width, height).data;
}

export function filterByColorSimilarity(
  originalData: Uint8ClampedArray,
  boundaryMask: Uint8ClampedArray,
  targetColor: { r: number; g: number; b: number },
  tolerance: number,
): { mask: Uint8ClampedArray; count: number } {
  const mask = new Uint8ClampedArray(originalData.length);
  let count = 0;

  for (let i = 0; i < boundaryMask.length; i += 4) {
    if (boundaryMask[i] === 255) {
      const r = originalData[i];
      const g = originalData[i + 1];
      const b = originalData[i + 2];
      const colorDiff = Math.sqrt(
        Math.pow(r - targetColor.r, 2) +
          Math.pow(g - targetColor.g, 2) +
          Math.pow(b - targetColor.b, 2),
      );
      if (colorDiff <= tolerance) {
        mask[i] = 255;
        mask[i + 1] = 100;
        mask[i + 2] = 0;
        mask[i + 3] = 255;
        count++;
      }
    }
  }

  return { mask, count };
}
