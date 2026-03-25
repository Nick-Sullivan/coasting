import { createEventSourcedState } from "../../events/createEventSourcedState";
import type { ImageProcessingEvent } from "./events";

type ImageProcessingState = {
  imageUrl: string | null;
  imageFile: File | null;
  layers: number;
  processing: boolean;
  result: any | null;
  error: string;
  selectionMask: ImageData | null;
};

const imageProcessingReducer = (
  state: ImageProcessingState,
  event: ImageProcessingEvent,
): ImageProcessingState => {
  switch (event.type) {
    case "ImageSelected":
      return {
        ...state,
        imageUrl: event.imageUrl,
        imageFile: event.file,
        result: null,
        error: "",
        selectionMask: null,
      };
    case "LayersChanged":
      return {
        ...state,
        layers: event.layers,
      };
    case "ProcessingStarted":
      return {
        ...state,
        processing: true,
        result: null,
        error: "",
      };
    case "ProcessingSucceeded":
      return {
        ...state,
        processing: false,
        result: event.result,
      };
    case "ProcessingFailed":
      return {
        ...state,
        processing: false,
        error: event.error,
      };
    case "SelectionMade":
      return {
        ...state,
        selectionMask: event.mask,
      };
    case "SelectionCleared":
      return {
        ...state,
        selectionMask: null,
      };
    default:
      return state;
  }
};

const initialState: ImageProcessingState = {
  imageUrl: null,
  imageFile: null,
  layers: 4,
  processing: false,
  result: null,
  error: "",
  selectionMask: null,
};

export const useImageProcessingState = createEventSourcedState(
  imageProcessingReducer,
  initialState,
);
