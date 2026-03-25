/// <reference lib="webworker" />

// Module-level state: persisted between 'render' messages
let storedRawSrc: Uint8ClampedArray | null = null;
let storedPw = 0;
let storedPh = 0;
let storedScale = 1;

// ── Scanline polygon fill ─────────────────────────────────────────────────────

function fillPolygon(
  poly: { x: number; y: number }[],
  pw: number,
  ph: number,
): Uint8Array {
  const mask = new Uint8Array(pw * ph);
  for (let y = 0; y < ph; y++) {
    const ys = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      if ((a.y <= ys && b.y > ys) || (b.y <= ys && a.y > ys)) {
        xs.push(a.x + ((ys - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i]));
      const x1 = Math.min(pw - 1, Math.floor(xs[i + 1]));
      for (let x = x0; x <= x1; x++) mask[y * pw + x] = 1;
    }
  }
  return mask;
}

// ── Overlay + mask computation ────────────────────────────────────────────────

function computeOverlay(
  rawSrc: Uint8ClampedArray,
  pw: number,
  ph: number,
  scale: number,
  selectionPoints: { x: number; y: number }[] | undefined,
  assignedMasks: Uint8ClampedArray[],
): { overlayBuffer: ArrayBuffer; maskBuffer: ArrayBuffer | null } {
  const n = pw * ph;
  const out = new Uint8ClampedArray(n * 4);
  let polyMask: Uint8Array | null = null;

  if (selectionPoints && selectionPoints.length >= 3) {
    const poly = selectionPoints.map((p) => ({
      x: p.x * scale,
      y: p.y * scale,
    }));
    polyMask = fillPolygon(poly, pw, ph);

    // Remove already-assigned pixels from the selection
    for (const mask of assignedMasks) {
      if (mask.length !== n * 4) continue;
      for (let i = 0; i < n; i++) {
        if (mask[i * 4 + 3] > 0) polyMask[i] = 0;
      }
    }

    for (let i = 0; i < n; i++) {
      if (polyMask[i]) {
        out[i * 4] = 99;
        out[i * 4 + 1] = 102;
        out[i * 4 + 2] = 241;
        out[i * 4 + 3] = 130;
      }
    }
  }

  // Dark overlay for assigned pixels
  for (const mask of assignedMasks) {
    if (mask.length !== n * 4) continue;
    for (let i = 0; i < n; i++) {
      if (mask[i * 4 + 3] > 0) {
        out[i * 4] = 20;
        out[i * 4 + 1] = 20;
        out[i * 4 + 2] = 20;
        out[i * 4 + 3] = 190;
      }
    }
  }

  // Extract selected pixels for coaster
  let maskBuffer: ArrayBuffer | null = null;
  if (polyMask) {
    const maskData = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      if (polyMask[i]) {
        maskData[i * 4] = rawSrc[i * 4];
        maskData[i * 4 + 1] = rawSrc[i * 4 + 1];
        maskData[i * 4 + 2] = rawSrc[i * 4 + 2];
        maskData[i * 4 + 3] = 255;
      }
    }
    maskBuffer = maskData.buffer;
  }

  return { overlayBuffer: out.buffer, maskBuffer };
}

// ── Message handler ──────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === "compute") {
    const {
      id,
      rawSrc: rawSrcBuf,
      pw,
      ph,
      scale,
      selectionPoints,
      assignedMasksBuffers,
    } = msg;

    storedRawSrc = new Uint8ClampedArray(rawSrcBuf);
    storedPw = pw;
    storedPh = ph;
    storedScale = scale;

    const assignedMasks = (assignedMasksBuffers as ArrayBuffer[]).map(
      (b) => new Uint8ClampedArray(b),
    );
    const { overlayBuffer, maskBuffer } = computeOverlay(
      storedRawSrc,
      pw,
      ph,
      scale,
      selectionPoints,
      assignedMasks,
    );

    const transfers: Transferable[] = [overlayBuffer];
    if (maskBuffer) transfers.push(maskBuffer);
    self.postMessage({ id, overlayBuffer, maskBuffer, pw, ph }, transfers);
  } else if (msg.type === "render") {
    if (!storedRawSrc) return;

    const { id, selectionPoints, assignedMasksBuffers } = msg;
    const assignedMasks = (assignedMasksBuffers as ArrayBuffer[]).map(
      (b) => new Uint8ClampedArray(b),
    );
    const { overlayBuffer, maskBuffer } = computeOverlay(
      storedRawSrc,
      storedPw,
      storedPh,
      storedScale,
      selectionPoints,
      assignedMasks,
    );

    const transfers: Transferable[] = [overlayBuffer];
    if (maskBuffer) transfers.push(maskBuffer);
    self.postMessage(
      { id, overlayBuffer, maskBuffer, pw: storedPw, ph: storedPh },
      transfers,
    );
  } else if (msg.type === "selectAll") {
    if (!storedRawSrc) return;

    const { id, assignedMasksBuffers } = msg;
    const assignedMasks = (assignedMasksBuffers as ArrayBuffer[]).map(
      (b) => new Uint8ClampedArray(b),
    );
    const n = storedPw * storedPh;

    // Start with all pixels selected, then remove assigned ones
    const polyMask = new Uint8Array(n).fill(1);
    for (const mask of assignedMasks) {
      if (mask.length !== n * 4) continue;
      for (let i = 0; i < n; i++) {
        if (mask[i * 4 + 3] > 0) polyMask[i] = 0;
      }
    }

    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      if (polyMask[i]) {
        out[i * 4] = 99;
        out[i * 4 + 1] = 102;
        out[i * 4 + 2] = 241;
        out[i * 4 + 3] = 130;
      }
    }
    for (const mask of assignedMasks) {
      if (mask.length !== n * 4) continue;
      for (let i = 0; i < n; i++) {
        if (mask[i * 4 + 3] > 0) {
          out[i * 4] = 20;
          out[i * 4 + 1] = 20;
          out[i * 4 + 2] = 20;
          out[i * 4 + 3] = 190;
        }
      }
    }

    const maskData = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      if (polyMask[i]) {
        maskData[i * 4] = storedRawSrc[i * 4];
        maskData[i * 4 + 1] = storedRawSrc[i * 4 + 1];
        maskData[i * 4 + 2] = storedRawSrc[i * 4 + 2];
        maskData[i * 4 + 3] = 255;
      }
    }

    const overlayBuffer = out.buffer;
    const maskBuffer = maskData.buffer;
    self.postMessage(
      { id, overlayBuffer, maskBuffer, pw: storedPw, ph: storedPh },
      [overlayBuffer, maskBuffer],
    );
  }
};
