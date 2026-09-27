/** Minimal event emitter: on(type, fn) returns an unsubscribe function. */
export function createEmitter() {
  const handlers = new Map();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type).delete(fn);
    },
    emit(type, detail) {
      handlers.get(type)?.forEach((fn) => fn(detail));
    },
  };
}
