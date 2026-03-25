export type ImageProcessingEvent =
  | { type: "ImageSelected"; imageUrl: string; file: File; timestamp: number }
  | { type: "LayersChanged"; layers: number; timestamp: number }
  | { type: "ProcessingStarted"; timestamp: number }
  | { type: "ProcessingSucceeded"; result: any; timestamp: number }
  | { type: "ProcessingFailed"; error: string; timestamp: number }
  | { type: "SelectionMade"; mask: ImageData; timestamp: number }
  | { type: "SelectionCleared"; timestamp: number };
