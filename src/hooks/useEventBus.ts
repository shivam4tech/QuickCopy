import { useEffect } from 'react';
import type { EventMap, EventHandler } from '@type/events';
import { eventBus } from '@utils/eventBus';

export function useEventBus<K extends keyof EventMap>(
  event: K,
  handler: EventHandler<EventMap[K]>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const unsubscribe = eventBus.on(event, handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
