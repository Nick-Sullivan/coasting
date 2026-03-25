import { useEffect, useRef } from "react";
import "./BasicSelector.css";

interface Props {
  imageFile: File | null;
  points: { x: number; y: number }[];
}

export default function BasicSelector({ imageFile, points }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  useEffect(() => {
    draw();
  }, [points]);

  function segmentsIntersect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number },
  ): boolean {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(det) < 1e-10) return false;

    const t =
      ((p3.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p3.y - p1.y)) / det;
    const u =
      ((p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y)) / det;

    return t > 0 && t < 1 && u > 0 && u < 1;
  }

  function getCleanPoints(
    pts: { x: number; y: number }[],
  ): { x: number; y: number }[] {
    if (pts.length < 4) return pts;
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = i + 2; j < pts.length - 1; j++) {
        if (segmentsIntersect(pts[i], pts[i + 1], pts[j], pts[j + 1])) {
          // First intersection found between segment i and segment j
          // Trim from first point (i) to second point (j+1)
          return pts.slice(i, j + 2);
        }
      }
    }
    return pts;
  }

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cleanPoints = getCleanPoints(points);
    if (cleanPoints.length < 3) return;

    ctx.strokeStyle = "#ff3e00";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(255, 62, 0, 0.3)";

    ctx.beginPath();
    ctx.moveTo(cleanPoints[0].x, cleanPoints[0].y);
    for (let i = 1; i < cleanPoints.length; i++) {
      ctx.lineTo(cleanPoints[i].x, cleanPoints[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (!imageFile) return null;

  return <canvas ref={canvasRef} className="basic-selector-canvas" />;
}
