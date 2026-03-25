import { useEffect, useRef, useState } from "react";
import "./DominantColorSelector.css";
import {
  computeEdgeMap,
  createPolygonMask,
  edgeFloodFill,
  traceBoundary,
} from "./imageProcessing/selectionUtils";

interface Props {
  imageFile: File | null;
  points: { x: number; y: number }[];
  onBoundaryChange?: (boundary: { x: number; y: number }[]) => void;
}

function pointInPolygon(
  px: number,
  py: number,
  poly: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y,
      xj = poly[j].x,
      yj = poly[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export default function DominantColorSelector({
  imageFile,
  points,
  onBoundaryChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageDataRef = useRef<Uint8ClampedArray | null>(null);
  const edgeMapRef = useRef<Float32Array | null>(null);
  const boundaryRef = useRef<{ x: number; y: number }[]>([]);
  const offsetRef = useRef({ x: 0, y: 0 });
  const seedRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOx: number;
    startOy: number;
  } | null>(null);
  const [threshold, setThreshold] = useState(40);
  const [moveMode, setMoveMode] = useState(false);
  const [seedMode, setSeedMode] = useState(false);
  const [regionColor, setRegionColor] = useState<{
    r: number;
    g: number;
    b: number;
  } | null>(null);
  const [hasSeed, setHasSeed] = useState(false);

  useEffect(() => {
    if (!imageFile || !canvasRef.current) return;
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const offscreen = document.createElement("canvas");
      offscreen.width = img.naturalWidth;
      offscreen.height = img.naturalHeight;
      const offCtx = offscreen.getContext("2d")!;
      offCtx.drawImage(img, 0, 0);
      const imageData = offCtx.getImageData(
        0,
        0,
        img.naturalWidth,
        img.naturalHeight,
      );
      imageDataRef.current = imageData.data;
      edgeMapRef.current = computeEdgeMap(
        imageData.data,
        img.naturalWidth,
        img.naturalHeight,
      );

      URL.revokeObjectURL(url);
      computeRegion();
    };
    img.src = url;
  }, [imageFile]);

  useEffect(() => {
    offsetRef.current = { x: 0, y: 0 };
    seedRef.current = null;
    setHasSeed(false);
    setSeedMode(false);
    computeRegion();
  }, [points, threshold]);

  function computeRegion() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (
      !canvas ||
      !ctx ||
      points.length < 3 ||
      !imageDataRef.current ||
      !edgeMapRef.current
    )
      return;

    const { width, height } = canvas;
    const polygonMask = createPolygonMask(points, width, height);
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    const seed = seedRef.current ?? { x: cx, y: cy };

    const regionMask = edgeFloodFill(
      edgeMapRef.current,
      imageDataRef.current,
      polygonMask,
      width,
      height,
      seed.x,
      seed.y,
      threshold,
    );

    let rSum = 0,
      gSum = 0,
      bSum = 0,
      count = 0;
    for (let i = 0; i < regionMask.length; i += 4) {
      if (regionMask[i] === 255) {
        rSum += imageDataRef.current[i];
        gSum += imageDataRef.current[i + 1];
        bSum += imageDataRef.current[i + 2];
        count++;
      }
    }
    if (count > 0) {
      setRegionColor({
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
      });
    }

    boundaryRef.current = traceBoundary(regionMask, width, height);
    onBoundaryChange?.(boundaryRef.current);
    renderMask();
  }

  function renderMask() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || points.length < 3) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Original drawn selection as dashed outline
    ctx.strokeStyle = "rgba(255, 62, 0, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++)
      ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const boundary = boundaryRef.current;
    if (boundary.length < 3) return;

    const { x: ox, y: oy } = offsetRef.current;
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(37, 99, 235, 0.25)";
    ctx.beginPath();
    ctx.moveTo(boundary[0].x + ox, boundary[0].y + oy);
    for (let i = 1; i < boundary.length; i++)
      ctx.lineTo(boundary[i].x + ox, boundary[i].y + oy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw seed crosshair if user has set one
    if (seedRef.current) {
      const { x: sx, y: sy } = seedRef.current;
      const r = 8;
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - r, sy);
      ctx.lineTo(sx + r, sy);
      ctx.moveTo(sx, sy - r);
      ctx.lineTo(sx, sy + r);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#facc15";
      ctx.fill();
    }
  }

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!seedMode) return;
    const { x, y } = getCanvasCoords(e);
    if (points.length < 3 || !pointInPolygon(x, y, points)) return;
    seedRef.current = { x, y };
    setHasSeed(true);
    setSeedMode(false);
    computeRegion();
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!moveMode) return;
    const { x, y } = getCanvasCoords(e);
    dragRef.current = {
      startX: x,
      startY: y,
      startOx: offsetRef.current.x,
      startOy: offsetRef.current.y,
    };
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!moveMode || !dragRef.current) return;
    const { x, y } = getCanvasCoords(e);
    offsetRef.current = {
      x: dragRef.current.startOx + x - dragRef.current.startX,
      y: dragRef.current.startOy + y - dragRef.current.startY,
    };
    renderMask();
  }

  function handleMouseUp() {
    dragRef.current = null;
  }

  if (!imageFile) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`dominant-color-selector-canvas${moveMode ? " move-mode" : seedMode ? " seed-mode" : ""}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="dominant-color-selector-controls">
        {regionColor && (
          <div className="dominant-color-swatch-row">
            <div
              className="dominant-color-swatch"
              style={{
                backgroundColor: `rgb(${regionColor.r}, ${regionColor.g}, ${regionColor.b})`,
              }}
            />
            <span>
              rgb({regionColor.r}, {regionColor.g}, {regionColor.b})
            </span>
          </div>
        )}
        <label>
          <span>Edge threshold: {threshold}</span>
          <input
            type="range"
            min={1}
            max={200}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <button
          className={`move-toggle${seedMode ? " active" : ""}`}
          onClick={() => setSeedMode((m) => !m)}
        >
          {seedMode ? "Click to place seed" : hasSeed ? "Re-seed" : "Set seed"}
        </button>
        {hasSeed && (
          <button
            className="move-toggle"
            onClick={() => {
              seedRef.current = null;
              setHasSeed(false);
              setSeedMode(false);
              computeRegion();
            }}
          >
            Reset seed
          </button>
        )}
        <button
          className={`move-toggle${moveMode ? " active" : ""}`}
          onClick={() => setMoveMode((m) => !m)}
        >
          {moveMode ? "Done" : "Move"}
        </button>
      </div>
    </>
  );
}
