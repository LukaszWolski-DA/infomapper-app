// A value that changes often and that only a few small components draw (slice 4p, trial A): the hovered row or line,
// the lasso being drawn. Kept outside React state so that setting it re-renders only the components that read it, never
// the canvas (`window.__imCanvasCommits` stays as it is while hovering or drawing a lasso).

import { useSyncExternalStore } from "react";

export interface ValueStore<T> {
  get: () => T;
  /** Sets the value; listeners run only when it changed (`same`, default `Object.is`). */
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createValueStore<T>(initial: T, same: (a: T, b: T) => boolean = Object.is): ValueStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (same(value, next)) return;
      value = next;
      for (const l of listeners) l();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** The store's value, re-rendering this component when it changes. */
export const useValue = <T,>(store: ValueStore<T>): T => useSyncExternalStore(store.subscribe, store.get, store.get);
