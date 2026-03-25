import { useEffect, useState } from "react";
import ColorSegmenter from "./ColorSegmenter";
import CursorTracer from "./CursorTracer";
import "./ImageEditor.css";

interface Props {
  imageFile: File | null;
  onSelectionChange?: (mask: ImageData | null) => void;
  assignedMasks?: (ImageData | null)[];
}

export default function ImageEditor({
  imageFile,
  onSelectionChange,
  assignedMasks,
}: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectionPoints, setSelectionPoints] = useState<
    { x: number; y: number }[]
  >([]);

  useEffect(() => {
    if (!imageFile) {
      setImageUrl(null);
      setLoading(false);
      setSelectionPoints([]);
      return;
    }
    setLoading(true);
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  if (!imageFile) return null;

  return (
    <div className="image-editor">
      {loading && (
        <div className="spinner-overlay">
          <div className="spinner" />
        </div>
      )}
      <img
        src={imageUrl ?? undefined}
        alt="Editing"
        decoding="async"
        onLoad={() => setLoading(false)}
      />
      <ColorSegmenter
        imageFile={imageFile}
        selectionPoints={selectionPoints}
        onSelectionChange={onSelectionChange}
        assignedMasks={assignedMasks}
      />
      <CursorTracer
        imageFile={imageFile}
        onTraceComplete={setSelectionPoints}
      />
    </div>
  );
}
