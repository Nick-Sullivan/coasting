import { useSyncExternalStore } from "react";
import { eventStore } from "./eventStore";
import type { EventEnvelope } from "./events";

export const createEventSourcedState = <TState, TEvent>(
  reducer: (state: TState, event: TEvent) => TState,
  initialState: TState,
) => {
  let currentState = initialState;
  let lastEventCount = 0;

  const getSnapshot = (): TState => {
    const events = eventStore.getEvents();
    if (events.length !== lastEventCount) {
      for (let i = lastEventCount; i < events.length; i++) {
        currentState = reducer(currentState, events[i].event as TEvent);
      }
      lastEventCount = events.length;
    }
    return currentState;
  };

  const subscribe = (callback: () => void): (() => void) => {
    const handleNewEvents = (_: EventEnvelope[]) => {
      callback();
    };
    eventStore.subscribe(handleNewEvents);
    return () => eventStore.unsubscribe(handleNewEvents);
  };

  return () => useSyncExternalStore(subscribe, getSnapshot);
};
