import { useEffect, useRef } from "react";
import "./PolygonEditor.css";

interface Props {
  imageFile: File | null;
  points: { x: number; y: number }[];
  onChange: (points: { x: number; y: number }[]) => void;
}

// Vertex drag: moves one vertex.
// Edge drag: moves both endpoints of a segment together.
type DragState = {
  type: "vertex" | "edge";
  index: number; // vertex index, or first vertex of the edge
  startX: number;
  startY: number;
  startPoints: { x: number; y: number }[];
} | null;

const CSS_HIT_R = 10; // hit detection radius in CSS pixels

// Ramer–Douglas–Peucker simplification
function ptLineDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax,
    dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function rdp(
  pts: { x: number; y: number }[],
  eps: number,
): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  let maxDist = 0,
    maxIdx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptLineDistance(
      pts[i].x,
      pts[i].y,
      pts[0].x,
      pts[0].y,
      pts[pts.length - 1].x,
      pts[pts.length - 1].y,
    );
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist > eps) {
    const left = rdp(pts.slice(0, maxIdx + 1), eps);
    const right = rdp(pts.slice(maxIdx), eps);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

function simplify(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const eps = Math.max(5, Math.hypot(maxX - minX, maxY - minY) / 40);
  const simplified = rdp(pts, eps);
  return simplified.length >= 3 ? simplified : pts;
}

export default function PolygonEditor({ imageFile, points, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const hoverRef = useRef<{ type: "vertex" | "edge"; index: number } | null>(
    null,
  );
  const dragRef = useRef<DragState>(null);

  useEffect(() => {
    pointsRef.current = simplify(points);
    draw();
  }, [points]);

  useEffect(() => {
    if (!imageFile || !canvasRef.current) return;
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      URL.revokeObjectURL(url);
      draw();
    };
    img.src = url;
  }, [imageFile]);

  function scale(): number {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const w = canvas.getBoundingClientRect().width;
    return w > 0 ? canvas.width / w : 1;
  }

  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const s = canvas.width / rect.width;
    return { x: (e.clientX - rect.left) * s, y: (e.clientY - rect.top) * s };
  }

  function distToSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): number {
    const dx = bx - ax,
      dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(
      0,
      Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq),
    );
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function findHover(x: number, y: number) {
    const pts = pointsRef.current;
    if (pts.length < 3) return null;
    const hitR = CSS_HIT_R * scale();

    for (let i = 0; i < pts.length; i++) {
      if (Math.hypot(pts[i].x - x, pts[i].y - y) < hitR) {
        return { type: "vertex" as const, index: i };
      }
    }
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      if (distToSegment(x, y, pts[i].x, pts[i].y, pts[j].x, pts[j].y) < hitR) {
        return { type: "edge" as const, index: i };
      }
    }
    return null;
  }

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pts = pointsRef.current;
    if (pts.length < 3) return;

    const s = scale();
    const hover = hoverRef.current;

    // Fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(124, 58, 237, 0.15)";
    ctx.fill();

    // Edges — highlight hovered segment
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const hov = hover?.type === "edge" && hover.index === i;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[j].x, pts[j].y);
      ctx.strokeStyle = hov ? "#c4b5fd" : "#7c3aed";
      ctx.lineWidth = (hov ? 3 : 2) * s;
      ctx.stroke();
    }

    // Vertex handle — only on hover
    if (hover?.type === "vertex") {
      const p = pts[hover.index];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * s, 0, Math.PI * 2);
      ctx.fillStyle = "#c4b5fd";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = canvasCoords(e);

    if (dragRef.current) {
      const drag = dragRef.current;
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      const newPts = drag.startPoints.map((p) => ({ ...p }));

      if (drag.type === "vertex") {
        newPts[drag.index] = {
          x: drag.startPoints[drag.index].x + dx,
          y: drag.startPoints[drag.index].y + dy,
        };
      } else {
        const j = (drag.index + 1) % newPts.length;
        newPts[drag.index] = {
          x: drag.startPoints[drag.index].x + dx,
          y: drag.startPoints[drag.index].y + dy,
        };
        newPts[j] = {
          x: drag.startPoints[j].x + dx,
          y: drag.startPoints[j].y + dy,
        };
      }

      pointsRef.current = newPts;
      draw();
      return;
    }

    const newHover = findHover(x, y);
    const prev = hoverRef.current;
    if (newHover?.type !== prev?.type || newHover?.index !== prev?.index) {
      hoverRef.current = newHover;
      draw();
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = newHover ? "move" : "default";
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = canvasCoords(e);
    const hover = findHover(x, y);
    if (!hover) return;
    dragRef.current = {
      type: hover.type,
      index: hover.index,
      startX: x,
      startY: y,
      startPoints: pointsRef.current.map((p) => ({ ...p })),
    };
  }

  function handleMouseUp() {
    if (dragRef.current) onChange([...pointsRef.current]);
    dragRef.current = null;
  }

  if (!imageFile) return null;

  const active = points.length >= 3;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="polygon-editor-canvas"
        style={{ pointerEvents: active ? "all" : "none" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {active && (
        <div className="polygon-editor-controls">
          <button className="polygon-editor-clear" onClick={() => onChange([])}>
            Clear
          </button>
        </div>
      )}
    </>
  );
}
