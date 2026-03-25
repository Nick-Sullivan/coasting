import { useEffect, useRef } from "react";
import "./CursorTracer.css";

interface Props {
  imageFile: File | null;
  onTraceComplete?: (points: { x: number; y: number }[]) => void;
}

export default function CursorTracer({ imageFile, onTraceComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (!imageFile || !canvasRef.current) return;
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [imageFile]);

  function getCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function interpolatePoints(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    maxDistance: number,
  ): { x: number; y: number }[] {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= maxDistance) return [p2];

    const steps = Math.ceil(distance / maxDistance);
    const interpolated: { x: number; y: number }[] = [];

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      interpolated.push({
        x: p1.x + dx * t,
        y: p1.y + dy * t,
      });
    }

    return interpolated;
  }

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pts = pointsRef.current;
    if (pts.length < 2) return;

    ctx.strokeStyle = "#ff3e00";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    isDrawingRef.current = true;
    pointsRef.current = [getCoords(e)];
    onTraceComplete?.([]);
    draw();
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const coords = getCoords(e);
    const pts = pointsRef.current;
    const last = pts[pts.length - 1];

    const newPoints = interpolatePoints(last, coords, 5);
    pointsRef.current = [...pts, ...newPoints];
    draw();
  }

  function handleMouseUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (pointsRef.current.length >= 3 && onTraceComplete) {
      onTraceComplete([...pointsRef.current]);
    }
  }

  if (!imageFile) return null;

  return (
    <canvas
      ref={canvasRef}
      className="cursor-tracer-canvas"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
