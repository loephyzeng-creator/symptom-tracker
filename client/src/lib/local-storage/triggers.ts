/**
 * 自定义触发因素的 localStorage 操作
 */
import { storage, generateId } from "./storage";

export interface TriggerLocal {
  id: number;
  name: string;
  createdAt: string;
}

export function getTriggers(): TriggerLocal[] {
  return storage.getItem<TriggerLocal[]>(storage.KEYS.TRIGGERS, []);
}

export function saveTriggers(triggers: TriggerLocal[]): void {
  storage.setItem(storage.KEYS.TRIGGERS, triggers);
}

export function addTrigger(name: string): TriggerLocal {
  const triggers = getTriggers();
  const newTrigger: TriggerLocal = {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
  };
  saveTriggers([...triggers, newTrigger]);
  return newTrigger;
}

export function deleteTrigger(id: number): void {
  const triggers = getTriggers();
  saveTriggers(triggers.filter((t) => t.id !== id));
}
