import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { asyncStorageAdapter, jsonSlot } from '@/core/storage';
import { accentOf, type Accent } from '@/design/palette';

import {
  DEFAULT_SETTINGS,
  decodeSettings,
  type ClockSettings,
} from './settings';

const slot = jsonSlot(asyncStorageAdapter, 'kiosk.settings.v1', decodeSettings);

interface SettingsValue {
  settings: ClockSettings;
  accent: Accent;
  /** False until stored settings have loaded, so nothing flashes defaults. */
  ready: boolean;
  update: (patch: Partial<ClockSettings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ClockSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    slot.load().then((stored) => {
      if (!active) return;
      setSettings(stored);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Writes are debounced so dragging a control doesn't hammer storage.
  const persist = useCallback((next: ClockSettings) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => slot.save(next), 250);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const update = useCallback(
    (patch: Partial<ClockSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  const value = useMemo<SettingsValue>(
    () => ({
      settings,
      accent: accentOf(settings.accent),
      ready,
      update,
      reset,
    }),
    [settings, ready, update, reset],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings must be used inside <SettingsProvider>');
  }
  return value;
}
