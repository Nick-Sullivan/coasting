import { useLayoutEffect, useRef } from "react";
import "./CoasterGrid.css";

interface Props {
  coasters: (ImageData | null)[];
  currentMask: ImageData | null;
  onAssign: (index: number) => void;
  onClear: (index: number) => void;
}

interface SlotProps {
  index: number;
  imageData: ImageData | null;
  assignable: boolean;
  onAssign: () => void;
  onClear: () => void;
}

function CoasterSlot({
  index,
  imageData,
  assignable,
  onAssign,
  onClear,
}: SlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!imageData) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
  }, [imageData]);

  return (
    <div
      className={`coaster-slot ${assignable ? "coaster-slot--assignable" : ""} ${imageData ? "coaster-slot--filled" : ""}`}
      onClick={assignable ? onAssign : undefined}
      title={
        assignable ? `Assign selection to coaster ${index + 1}` : undefined
      }
    >
      <canvas ref={canvasRef} className="coaster-slot__canvas" />
      {!imageData && <span className="coaster-slot__number">{index + 1}</span>}
      {imageData && (
        <button
          className="coaster-slot__clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          title="Clear coaster"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function CoasterGrid({
  coasters,
  currentMask,
  onAssign,
  onClear,
}: Props) {
  return (
    <div className="coaster-grid">
      {coasters.map((imageData, i) => (
        <CoasterSlot
          key={i}
          index={i}
          imageData={imageData}
          assignable={currentMask !== null}
          onAssign={() => onAssign(i)}
          onClear={() => onClear(i)}
        />
      ))}
    </div>
  );
}
