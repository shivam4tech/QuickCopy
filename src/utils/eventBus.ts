import type { EventMap, EventHandler, Unsubscribe, EventBusInterface } from '@type/events';
import { logger } from './logger';

export class EventBus implements EventBusInterface {
  private listeners = new Map<keyof EventMap, Set<EventHandler>>();
  private onceListeners = new Map<keyof EventMap, Set<EventHandler>>();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);

    return () => {
      this.listeners.get(event)?.delete(handler as EventHandler);
    };
  }

  once<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): Unsubscribe {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(handler as EventHandler);

    return () => {
      this.onceListeners.get(event)?.delete(handler as EventHandler);
    };
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as (d: unknown) => void)(data);
        } catch (error) {
          logger.error(`EventBus handler error for event "${String(event)}"`, error);
        }
      });
    }

    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      onceHandlers.forEach((handler) => {
        try {
          (handler as (d: unknown) => void)(data);
        } catch (error) {
          logger.error(`EventBus once-handler error for event "${String(event)}"`, error);
        }
      });
      this.onceListeners.delete(event);
    }
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as EventHandler);
    this.onceListeners.get(event)?.delete(handler as EventHandler);
  }

  clear(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }

  listenerCount<K extends keyof EventMap>(event: K): number {
    return (this.listeners.get(event)?.size ?? 0) + (this.onceListeners.get(event)?.size ?? 0);
  }
}

export const eventBus = new EventBus();
