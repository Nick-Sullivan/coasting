import { useEffect, useState } from "react";
import CoasterGrid from "../components/CoasterGrid";
import ImageEditor from "../components/ImageEditor";
import ImageLoader from "../components/ImageLoader";
import "./ImageSplittingPage.css";

function mergeMasks(existing: ImageData | null, newMask: ImageData): ImageData {
  if (
    !existing ||
    existing.width !== newMask.width ||
    existing.height !== newMask.height
  ) {
    return newMask;
  }
  const out = new Uint8ClampedArray(existing.data);
  const n = newMask.width * newMask.height;
  for (let i = 0; i < n; i++) {
    if (newMask.data[i * 4 + 3] > 0) {
      out[i * 4] = newMask.data[i * 4];
      out[i * 4 + 1] = newMask.data[i * 4 + 1];
      out[i * 4 + 2] = newMask.data[i * 4 + 2];
      out[i * 4 + 3] = 255;
    }
  }
  return new ImageData(out, newMask.width, newMask.height);
}

export default function ImageSplittingPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coasterCount, setCoasterCount] = useState(2);
  const [coasters, setCoasters] = useState<(ImageData | null)[]>([null, null]);
  const [currentMask, setCurrentMask] = useState<ImageData | null>(null);

  function handleImageSelect(url: string, file: File) {
    setImageUrl(url);
    setImageFile(file);
    setCurrentMask(null);
    setCoasters((prev) => prev.map(() => null));
  }

  function handleCoasterCountChange(count: number) {
    const clamped = Math.max(1, Math.min(8, count));
    setCoasterCount(clamped);
    setCoasters((prev) =>
      Array.from({ length: clamped }, (_, i) => prev[i] ?? null),
    );
  }

  function handleAssign(index: number) {
    if (!currentMask) return;
    setCoasters((prev) =>
      prev.map((c, i) => (i === index ? mergeMasks(c, currentMask) : c)),
    );
  }

  function handleClear(index: number) {
    setCoasters((prev) => prev.map((c, i) => (i === index ? null : c)));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!currentMask) return;
      const digit = parseInt(e.key, 10);
      if (isNaN(digit) || digit < 1 || digit > 8) return;
      const index = digit - 1;
      if (index >= coasterCount) return;
      setCoasters((prev) =>
        prev.map((c, i) => (i === index ? mergeMasks(c, currentMask) : c)),
      );
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentMask, coasterCount]);

  return (
    <>
      <ImageLoader imageUrl={imageUrl} onImageSelect={handleImageSelect} />

      {imageUrl && (
        <div className="editor-layout">
          <ImageEditor
            imageFile={imageFile}
            onSelectionChange={setCurrentMask}
            assignedMasks={coasters}
          />
          <div className="coaster-panel">
            <div className="coaster-count-control">
              <label>
                Coasters:
                <button
                  onClick={() => handleCoasterCountChange(coasterCount - 1)}
                  disabled={coasterCount <= 1}
                >
                  −
                </button>
                <span>{coasterCount}</span>
                <button
                  onClick={() => handleCoasterCountChange(coasterCount + 1)}
                  disabled={coasterCount >= 8}
                >
                  +
                </button>
              </label>
            </div>
            <CoasterGrid
              coasters={coasters}
              currentMask={currentMask}
              onAssign={handleAssign}
              onClear={handleClear}
            />
          </div>
        </div>
      )}
    </>
  );
}
