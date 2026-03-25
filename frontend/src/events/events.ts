import type { ImageProcessingEvent } from "../components/imageProcessing/events";

export type Event = ImageProcessingEvent;

export type EventEnvelope = {
  id: string;
  event: Event;
};
