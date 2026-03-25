import { useRef } from "react";
import "./ImageLoader.css";

interface Props {
  imageUrl: string | null;
  onImageSelect: (imageUrl: string, file: File) => void;
}

export default function ImageLoader({ imageUrl, onImageSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      onImageSelect(url, file);
    }
  }

  return (
    <div className="image-loader">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <button onClick={() => inputRef.current?.click()}>
        {imageUrl ? "Change Image" : "Load Image"}
      </button>
    </div>
  );
}
