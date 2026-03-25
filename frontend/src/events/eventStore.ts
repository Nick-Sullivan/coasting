import type { Event, EventEnvelope } from "./events";

export const createEventStore = () => {
  let events: EventEnvelope[] = [];
  let subscribers: Array<(newEvents: EventEnvelope[]) => void> = [];

  const append = (event: Event): void => {
    const envelope: EventEnvelope = {
      id: crypto.randomUUID(),
      event,
    };
    events = [...events, envelope];
    notifySubscribers([envelope]);
  };

  const getEvents = (): EventEnvelope[] => {
    return [...events];
  };

  const subscribe = (callback: (newEvents: EventEnvelope[]) => void): void => {
    subscribers = [...subscribers, callback];
    callback(getEvents());
  };

  const unsubscribe = (
    callback: (newEvents: EventEnvelope[]) => void,
  ): void => {
    subscribers = subscribers.filter((sub) => sub !== callback);
  };

  const notifySubscribers = (newEvents: EventEnvelope[]): void => {
    subscribers.forEach((callback) => callback(newEvents));
  };

  return { append, getEvents, subscribe, unsubscribe };
};

export const eventStore = createEventStore();
