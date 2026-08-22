/**
 * In-app notification store (persisted).
 * Push delivery requires Expo project credentials — not configured here.
 * This implements real in-app notifications that appear in Account.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIF_KEY = "@nutricheck:notifications";
const ENABLED_KEY = "@nutricheck:notifications_enabled";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

type Listener = () => void;

class NotificationStore {
  private items: AppNotification[] = [];
  private enabled = true;
  private initialized = false;
  private listeners: Set<Listener> = new Set();

  private notify() {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const [raw, enabledRaw] = await Promise.all([
        AsyncStorage.getItem(NOTIF_KEY),
        AsyncStorage.getItem(ENABLED_KEY),
      ]);
      if (raw) this.items = JSON.parse(raw) as AppNotification[];
      if (enabledRaw !== null) this.enabled = enabledRaw === "true";
    } catch {
      /* ignore */
    }
    this.notify();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getItems(): AppNotification[] {
    return this.items;
  }

  unreadCount(): number {
    return this.items.filter((n) => !n.read).length;
  }

  async setEnabled(value: boolean): Promise<void> {
    this.enabled = value;
    try {
      await AsyncStorage.setItem(ENABLED_KEY, value ? "true" : "false");
    } catch {
      /* ignore */
    }
    this.notify();
  }

  async push(title: string, body: string): Promise<void> {
    if (!this.enabled) return;
    const item: AppNotification = {
      id: `n_${Date.now()}`,
      title,
      body,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.items = [item, ...this.items].slice(0, 50);
    try {
      await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(this.items));
    } catch {
      /* ignore */
    }
    this.notify();
  }

  async markAllRead(): Promise<void> {
    this.items = this.items.map((n) => ({ ...n, read: true }));
    try {
      await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(this.items));
    } catch {
      /* ignore */
    }
    this.notify();
  }

  async clear(): Promise<void> {
    this.items = [];
    try {
      await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify([]));
    } catch {
      /* ignore */
    }
    this.notify();
  }
}

export const notificationStore = new NotificationStore();
