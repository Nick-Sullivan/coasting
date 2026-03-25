import { useEffect, useRef, useState } from "react";
import "./ColorSegmenter.css";

interface Props {
  imageFile: File | null;
  selectionPoints?: { x: number; y: number }[];
  onSelectionChange?: (mask: ImageData | null) => void;
  assignedMasks?: (ImageData | null)[];
}

export default function ColorSegmenter({
  imageFile,
  selectionPoints,
  onSelectionChange,
  assignedMasks,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const latestIdRef = useRef(0);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const selectionPointsRef = useRef(selectionPoints);
  const assignedMasksRef = useRef(assignedMasks);

  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  // Keep refs in sync with latest props/state
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);
  useEffect(() => {
    selectionPointsRef.current = selectionPoints;
  }, [selectionPoints]);
  useEffect(() => {
    assignedMasksRef.current = assignedMasks;
  }, [assignedMasks]);
  useEffect(() => {
    imgElRef.current = imgEl;
  }, [imgEl]);

  // Create worker once on mount
  useEffect(() => {
    const worker = new Worker(
      new URL("./colorSegmenter.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const { id, overlayBuffer, maskBuffer, pw, ph } = e.data;
      if (id !== latestIdRef.current) return; // discard stale result

      const canvas = canvasRef.current;
      const img = imgElRef.current;
      if (!canvas || !img) return;

      // Scale overlay up to natural image dimensions
      const small = document.createElement("canvas");
      small.width = pw;
      small.height = ph;
      small
        .getContext("2d")!
        .putImageData(
          new ImageData(new Uint8ClampedArray(overlayBuffer), pw, ph),
          0,
          0,
        );
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);

      onSelectionChangeRef.current?.(
        maskBuffer
          ? new ImageData(new Uint8ClampedArray(maskBuffer), pw, ph)
          : null,
      );
    };

    return () => worker.terminate();
  }, []);

  // Load image element when file changes
  useEffect(() => {
    if (!imageFile) {
      setImgEl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setImgEl(img);
    };
    img.src = url;
  }, [imageFile]);

  // Store image data in worker when image changes
  useEffect(() => {
    if (!imgEl) return;

    const MAX_DIM = 250;
    const scale = Math.min(
      1,
      MAX_DIM / Math.max(imgEl.naturalWidth, imgEl.naturalHeight),
    );
    const pw = Math.max(1, Math.round(imgEl.naturalWidth * scale));
    const ph = Math.max(1, Math.round(imgEl.naturalHeight * scale));

    const small = document.createElement("canvas");
    small.width = pw;
    small.height = ph;
    const sCtx = small.getContext("2d")!;
    sCtx.drawImage(imgEl, 0, 0, pw, ph);
    const rawSrc = sCtx.getImageData(0, 0, pw, ph).data as Uint8ClampedArray;

    const id = ++latestIdRef.current;
    const assignedMasksBuffers = (assignedMasksRef.current ?? [])
      .filter(
        (m): m is ImageData => m !== null && m.width === pw && m.height === ph,
      )
      .map((m) => m.data.buffer.slice(0) as ArrayBuffer);

    workerRef.current?.postMessage(
      {
        type: "compute",
        id,
        rawSrc: rawSrc.buffer,
        pw,
        ph,
        scale,
        selectionPoints: selectionPointsRef.current,
        assignedMasksBuffers,
      },
      [rawSrc.buffer, ...assignedMasksBuffers],
    );
  }, [imgEl]);

  // Ctrl+A: select all unassigned pixels
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!imgElRef.current) return;
        const id = ++latestIdRef.current;
        const assignedMasksBuffers = (assignedMasksRef.current ?? [])
          .filter((m): m is ImageData => m !== null)
          .map((m) => m.data.buffer.slice(0) as ArrayBuffer);
        workerRef.current?.postMessage(
          { type: "selectAll", id, assignedMasksBuffers },
          assignedMasksBuffers,
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Re-render overlay when selection or masks change
  useEffect(() => {
    if (!imgEl) return;

    const id = ++latestIdRef.current;
    const assignedMasksBuffers = (assignedMasks ?? [])
      .filter((m): m is ImageData => m !== null)
      .map((m) => m.data.buffer.slice(0) as ArrayBuffer);

    workerRef.current?.postMessage(
      { type: "render", id, selectionPoints, assignedMasksBuffers },
      assignedMasksBuffers,
    );
  }, [selectionPoints, assignedMasks]);

  if (!imageFile) return null;

  return <canvas ref={canvasRef} className="color-segmenter-canvas" />;
}
